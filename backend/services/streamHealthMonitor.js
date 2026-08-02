/**
 * Stream Health Monitor Daemon
 * Runs every 15 minutes. Pings all known embed server URL patterns with a sample title.
 * Flags degraded servers in Redis. Frontend reads flags and skips broken servers.
 * Also sends a Telegram alert when a server transitions from healthy → degraded.
 */
const axios = require('axios');
const redisService = require('./redisService');

// Test title: The Dark Knight (TMDB ID 155) — very stable, always indexed
const TEST_MOVIE_ID = 155;
const TEST_TV_ID = 1396;   // Breaking Bad
const TEST_SEASON = 1;
const TEST_EP = 1;

/**
 * All known embed servers. Each has a name and a URL template.
 * Timeout = 8s, we do a HEAD or GET to check reachability.
 */
const SERVERS = [
  {
    id: 'multiembed',
    name: 'Server 1 (MultiEmbed)',
    movieUrl: `https://multiembed.mov/directstream.php?video_id=${TEST_MOVIE_ID}&tmdb=1`,
    tvUrl: `https://multiembed.mov/directstream.php?video_id=${TEST_TV_ID}&tmdb=1&s=${TEST_SEASON}&e=${TEST_EP}`,
  },
  {
    id: 'vidsrc',
    name: 'Server 2 (VidSrc)',
    movieUrl: `https://vidsrc.to/embed/movie/${TEST_MOVIE_ID}`,
    tvUrl: `https://vidsrc.to/embed/tv/${TEST_TV_ID}/${TEST_SEASON}/${TEST_EP}`,
  },
  {
    id: 'embed_su',
    name: 'Server 3 (Embed.su)',
    movieUrl: `https://embed.su/embed/movie/${TEST_MOVIE_ID}`,
    tvUrl: `https://embed.su/embed/tv/${TEST_TV_ID}/${TEST_SEASON}/${TEST_EP}`,
  },
  {
    id: 'autoembed',
    name: 'Server 4 (AutoEmbed)',
    movieUrl: `https://autoembed.co/movie/tmdb/${TEST_MOVIE_ID}`,
    tvUrl: `https://autoembed.co/tv/tmdb/${TEST_TV_ID}-${TEST_SEASON}-${TEST_EP}`,
  },
  {
    id: 'smashystream',
    name: 'Server 5 (SmashyStream)',
    movieUrl: `https://player.smashy.stream/movie/${TEST_MOVIE_ID}`,
    tvUrl: `https://player.smashy.stream/tv/${TEST_TV_ID}?s=${TEST_SEASON}&e=${TEST_EP}`,
  },
  {
    id: '2embed',
    name: 'Server 6 (2Embed)',
    movieUrl: `https://www.2embed.cc/embed/${TEST_MOVIE_ID}`,
    tvUrl: `https://www.2embed.cc/embedtv/${TEST_TV_ID}&s=${TEST_SEASON}&e=${TEST_EP}`,
  },
];

/**
 * Ping a URL and return its health status.
 */
async function pingServer(url) {
  const start = Date.now();
  try {
    const resp = await axios.head(url, {
      timeout: 8000,
      maxRedirects: 3,
      validateStatus: (s) => s < 500, // 4xx = reachable but blocked, 5xx = server error
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RealSSABot/1.0)' },
    });
    const latency = Date.now() - start;
    // 403 = probably geo-blocked or auth wall but server is up
    // 200/301/302 = healthy
    const healthy = resp.status < 500;
    return { healthy, status: resp.status, latency };
  } catch (err) {
    return { healthy: false, status: 0, latency: Date.now() - start, error: err.message };
  }
}

/**
 * Send Telegram alert (if TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set)
 */
async function sendTelegramAlert(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
    });
  } catch (_) {}
}

/**
 * Main health check runner. Called by cron every 15 minutes.
 */
async function runStreamHealthCheck() {
  console.log('🔍 [Stream Health] Starting server health check...');
  const results = {};

  for (const server of SERVERS) {
    // Test both movie and TV URL
    const [movieCheck, tvCheck] = await Promise.all([
      pingServer(server.movieUrl),
      pingServer(server.tvUrl),
    ]);

    // Server is considered healthy if either movie or TV endpoint responds OK
    const healthy = movieCheck.healthy || tvCheck.healthy;
    const avgLatency = Math.round((movieCheck.latency + tvCheck.latency) / 2);

    // Read previous state to detect transitions
    const prevKey = `cinema:server:health:${server.id}`;
    const prevState = await redisService.getCached(prevKey);

    const currentState = {
      id: server.id,
      name: server.name,
      healthy,
      movie_status: movieCheck.status,
      tv_status: tvCheck.status,
      latency_ms: avgLatency,
      last_checked: new Date().toISOString(),
    };

    // Alert on state transition: healthy → degraded
    if (prevState && prevState.healthy && !healthy) {
      const alert = `⚠️ <b>RealSSA Stream Alert</b>\n<b>${server.name}</b> went OFFLINE\nMovie: HTTP ${movieCheck.status}\nTV: HTTP ${tvCheck.status}\nTime: ${new Date().toISOString()}`;
      await sendTelegramAlert(alert);
      console.warn(`🚨 [Stream Health] ${server.name} DEGRADED — was healthy`);
    }

    // Alert on recovery: degraded → healthy
    if (prevState && !prevState.healthy && healthy) {
      const alert = `✅ <b>RealSSA Stream Alert</b>\n<b>${server.name}</b> is back ONLINE\nLatency: ${avgLatency}ms`;
      await sendTelegramAlert(alert);
      console.log(`✅ [Stream Health] ${server.name} RECOVERED`);
    }

    // Save to Redis (TTL 20 min — slightly longer than cron interval)
    await redisService.setCached(prevKey, currentState, 60 * 20);
    results[server.id] = currentState;

    console.log(`  ${healthy ? '✅' : '❌'} ${server.name} — ${avgLatency}ms`);
  }

  // Also store summary for the /api/cinema/server-health endpoint
  await redisService.setCached('cinema:server:health:all', results, 60 * 20);

  console.log('✅ [Stream Health] Health check complete.');
  return results;
}

/**
 * Get current server health states from Redis (for frontend).
 * Returns a map of { serverId: { healthy, name, latency_ms } }
 */
async function getServerHealthStatus() {
  const all = await redisService.getCached('cinema:server:health:all');
  if (all) return all;

  // No data yet — return all servers as unknown/healthy (don't block play)
  return SERVERS.reduce((acc, s) => {
    acc[s.id] = { id: s.id, name: s.name, healthy: true, latency_ms: null, last_checked: null };
    return acc;
  }, {});
}

module.exports = { runStreamHealthCheck, getServerHealthStatus, SERVERS };
