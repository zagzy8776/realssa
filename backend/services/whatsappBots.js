/**
 * WhatsApp Channel Bot Service
 * Three bots posting to: https://whatsapp.com/channel/0029VbDetsPGufIx3Totk938
 *
 * Bot 1 — News Publisher   : posts AI-summarized articles with image every 30 min
 * Bot 2 — Sports Notifier  : posts match kickoff alerts + score check-ins mid-game
 * Bot 3 — Trending Videos  : grabs trending YouTube/sports clips and posts links
 *
 * WhatsApp does NOT have a public API for channels — we use the Green API
 * (https://green-api.com) which is the most reliable unofficial gateway.
 * Set these env vars:
 *   GREENAPI_INSTANCE_ID   — your Green API instance ID
 *   GREENAPI_TOKEN         — your Green API token
 *   WHATSAPP_CHANNEL_ID    — the channel JID e.g. 120363xxxxxxxxx@newsletter
 */

const axios = require('axios');

const GREENAPI_BASE = process.env.GREENAPI_BASE_URL
  ? `${process.env.GREENAPI_BASE_URL}/waInstance${process.env.GREENAPI_INSTANCE_ID}`
  : `https://api.green-api.com/waInstance${process.env.GREENAPI_INSTANCE_ID}`;
const GREENAPI_TOKEN = process.env.GREENAPI_TOKEN;
const CHANNEL_ID = process.env.WHATSAPP_CHANNEL_ID; // e.g. 120363xxxxxxxxx@newsletter

// Groq key dedicated to WhatsApp bots (use the third key)
const GROQ_KEY = process.env.GROQ_WA_KEY || process.env.GROQ_API_KEY?.split(',').pop()?.trim();

// ─── Shared helpers ────────────────────────────────────────────────────────

async function groqSummarize(title, excerpt) {
  if (!GROQ_KEY) return excerpt?.slice(0, 200) || title;
  try {
    const r = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are a WhatsApp news editor for RealSSA News (Africa's top news platform).
Write a punchy 2-3 sentence WhatsApp summary of this article.
- Sound like a smart human friend sharing breaking news, not a robot
- Use 1-2 relevant emojis naturally
- End with a hook that makes people want to read more
- Max 180 characters total`
          },
          { role: 'user', content: `Title: ${title}\n\nExcerpt: ${excerpt || ''}` }
        ],
        max_tokens: 120,
        temperature: 0.75
      },
      { headers: { Authorization: `Bearer ${GROQ_KEY}` }, timeout: 8000 }
    );
    return r.data.choices?.[0]?.message?.content?.trim() || excerpt?.slice(0, 200);
  } catch (e) {
    console.warn('[WA Bot] Groq summarize failed:', e.message);
    return excerpt?.slice(0, 200) || title;
  }
}

async function sendWAText(message) {
  if (!GREENAPI_TOKEN || !CHANNEL_ID) {
    console.warn('[WA Bot] Missing GREENAPI_TOKEN or WHATSAPP_CHANNEL_ID');
    return false;
  }
  try {
    await axios.post(
      `${GREENAPI_BASE}/sendMessage/${GREENAPI_TOKEN}`,
      { chatId: CHANNEL_ID, message },
      { timeout: 10000 }
    );
    return true;
  } catch (e) {
    console.error('[WA Bot] sendWAText failed:', e.response?.data || e.message);
    return false;
  }
}

async function sendWAImage(imageUrl, caption) {
  if (!GREENAPI_TOKEN || !CHANNEL_ID) return false;
  try {
    await axios.post(
      `${GREENAPI_BASE}/sendFileByUrl/${GREENAPI_TOKEN}`,
      {
        chatId: CHANNEL_ID,
        urlFile: imageUrl,
        fileName: 'news.jpg',
        caption
      },
      { timeout: 15000 }
    );
    return true;
  } catch (e) {
    // Fall back to text-only if image fails
    console.warn('[WA Bot] Image send failed, falling back to text:', e.message);
    return sendWAText(caption);
  }
}

// ─── BOT 1: News Publisher ─────────────────────────────────────────────────
// Runs every 30 minutes. Picks the freshest unposted article, summarizes it,
// posts image + summary + read link to the channel.

const postedArticleIds = new Set(); // in-memory dedup (resets on server restart)

async function runNewsPublisherBot(pool) {
  try {
    if (!pool) return;

    const result = await pool.query(`
      SELECT id, title, original_excerpt, ai_summary, image, external_link, category, source_name
      FROM rss_articles
      WHERE image IS NOT NULL AND image != ''
        AND published_at > NOW() - INTERVAL '2 hours'
      ORDER BY published_at DESC
      LIMIT 20
    `);

    // Find first article not yet posted this session
    const article = result.rows.find(r => !postedArticleIds.has(String(r.id)));
    if (!article) {
      console.log('[WA NewsBot] No new articles to post');
      return;
    }

    postedArticleIds.add(String(article.id));

    const summary = await groqSummarize(
      article.title,
      article.ai_summary || article.original_excerpt
    );

    const articleUrl = `https://www.realssanews.com.ng/article/rss-${article.id}`;
    const category = (article.category || 'News').toUpperCase();

    const caption =
      `📰 *${article.title}*\n\n` +
      `${summary}\n\n` +
      `🏷️ #${category.replace(/[^A-Z0-9]/gi, '')}\n` +
      `👉 Read more: ${articleUrl}\n\n` +
      `📲 Follow RealSSA for more: https://whatsapp.com/channel/0029VbDetsPGufIx3Totk938`;

    const sent = await sendWAImage(article.image, caption);
    console.log(`[WA NewsBot] ${sent ? '✅' : '❌'} Posted: "${article.title.slice(0, 50)}"`);
  } catch (e) {
    console.error('[WA NewsBot] Error:', e.message);
  }
}

// ─── BOT 2: Sports Notifier ────────────────────────────────────────────────
// Checks matches every 5 minutes.
// - 15 min before kickoff → posts "Match Starting Soon" alert
// - 45 min into game → posts "Half Time — what's the score?" check-in
// - After full time → posts final score

const notifiedMatches = new Map(); // matchId → { kickoff: bool, halftime: bool, fulltime: bool }

async function runSportsNotifierBot(pool) {
  try {
    if (!pool) return;

    const result = await pool.query(`
      SELECT provider_match_id, competition_name,
             home_team_name, away_team_name,
             home_score, away_score,
             status, minute, kickoff_at
      FROM matches
      WHERE kickoff_at > NOW() - INTERVAL '3 hours'
        AND kickoff_at < NOW() + INTERVAL '20 minutes'
      ORDER BY kickoff_at ASC
      LIMIT 10
    `);

    const now = Date.now();

    for (const match of result.rows) {
      const id = match.provider_match_id;
      if (!notifiedMatches.has(id)) notifiedMatches.set(id, {});
      const state = notifiedMatches.get(id);

      const kickoffMs = new Date(match.kickoff_at).getTime();
      const minsToKickoff = (kickoffMs - now) / 60000;
      const minuteInGame = parseInt(match.minute) || 0;

      // 1. Pre-match alert (10-20 min before kickoff)
      if (!state.kickoff && minsToKickoff > 0 && minsToKickoff <= 20) {
        state.kickoff = true;
        const msg =
          `⚽ *MATCH STARTING SOON!*\n\n` +
          `🏆 ${match.competition_name}\n` +
          `🆚 *${match.home_team_name}* vs *${match.away_team_name}*\n` +
          `⏰ Kicks off in ~${Math.round(minsToKickoff)} minutes!\n\n` +
          `Who are you backing? Drop your prediction 👇\n\n` +
          `📲 https://whatsapp.com/channel/0029VbDetsPGufIx3Totk938`;
        await sendWAText(msg);
        console.log(`[WA SportsBot] ✅ Pre-match alert: ${match.home_team_name} vs ${match.away_team_name}`);
      }

      // 2. Half-time check-in (around 45 min)
      if (!state.halftime && match.status === 'live' && minuteInGame >= 44 && minuteInGame <= 50) {
        state.halftime = true;
        const score = `${match.home_score ?? 0} - ${match.away_score ?? 0}`;
        const msg =
          `🔔 *HALF TIME CHECK-IN*\n\n` +
          `⚽ ${match.home_team_name} ${score} ${match.away_team_name}\n` +
          `🏆 ${match.competition_name}\n\n` +
          `What do you think of the first half? 🤔\n` +
          `Who scores next in the second half? 👇\n\n` +
          `📲 https://whatsapp.com/channel/0029VbDetsPGufIx3Totk938`;
        await sendWAText(msg);
        console.log(`[WA SportsBot] ✅ Half-time check-in: ${match.home_team_name} vs ${match.away_team_name}`);
      }

      // 3. Full-time result
      if (!state.fulltime && match.status === 'finished') {
        state.fulltime = true;
        const score = `${match.home_score ?? 0} - ${match.away_score ?? 0}`;
        const winner =
          match.home_score > match.away_score ? match.home_team_name
          : match.away_score > match.home_score ? match.away_team_name
          : null;
        const resultLine = winner ? `🏆 ${winner} wins!` : `🤝 It's a draw!`;
        const msg =
          `🔔 *FULL TIME!*\n\n` +
          `⚽ *${match.home_team_name} ${score} ${match.away_team_name}*\n` +
          `🏆 ${match.competition_name}\n` +
          `${resultLine}\n\n` +
          `React with your thoughts 👇\n\n` +
          `📲 https://whatsapp.com/channel/0029VbDetsPGufIx3Totk938`;
        await sendWAText(msg);
        console.log(`[WA SportsBot] ✅ Full-time result: ${match.home_team_name} ${score} ${match.away_team_name}`);
      }
    }
  } catch (e) {
    console.error('[WA SportsBot] Error:', e.message);
  }
}

// ─── BOT 3: Trending Videos Bot ───────────────────────────────────────────
// Runs every 2 hours. Grabs trending African/sports YouTube videos via
// YouTube Data API and posts the top 2 to the channel.
// No website involvement — purely WhatsApp channel posts.

const postedVideoIds = new Set();

async function runTrendingVideosBot() {
  try {
    const ytKey = process.env.YOUTUBE_API_KEY;
    if (!ytKey) {
      console.warn('[WA VideoBot] No YOUTUBE_API_KEY set, skipping');
      return;
    }

    // Search for trending African news/sports videos published in last 6 hours
    const queries = [
      'Nigeria news today',
      'Africa football highlights',
      'Afrobeats trending'
    ];

    const query = queries[Math.floor(Date.now() / (2 * 3600000)) % queries.length]; // rotate every 2h

    const searchRes = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        q: query,
        type: 'video',
        order: 'viewCount',
        publishedAfter: new Date(Date.now() - 6 * 3600000).toISOString(),
        maxResults: 5,
        key: ytKey
      },
      timeout: 8000
    });

    const videos = (searchRes.data.items || []).filter(v => !postedVideoIds.has(v.id.videoId));
    if (videos.length === 0) {
      console.log('[WA VideoBot] No new trending videos');
      return;
    }

    const video = videos[0];
    postedVideoIds.add(video.id.videoId);

    const title = video.snippet.title;
    const channel = video.snippet.channelTitle;
    const videoUrl = `https://youtu.be/${video.id.videoId}`;
    const thumb = video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.default?.url;

    // Use Groq to write a human hook for the video
    let hook = `🎬 Trending now: ${title}`;
    if (GROQ_KEY) {
      try {
        const r = await axios.post(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            model: 'llama-3.3-70b-versatile',
            messages: [
              {
                role: 'system',
                content: 'Write a 1-sentence WhatsApp hook for this trending video. Sound excited and human. Max 80 chars.'
              },
              { role: 'user', content: `Video title: ${title} by ${channel}` }
            ],
            max_tokens: 60,
            temperature: 0.8
          },
          { headers: { Authorization: `Bearer ${GROQ_KEY}` }, timeout: 6000 }
        );
        hook = r.data.choices?.[0]?.message?.content?.trim() || hook;
      } catch (_) {}
    }

    const caption =
      `🎬 *${hook}*\n\n` +
      `📺 ${title}\n` +
      `▶️ ${videoUrl}\n\n` +
      `📲 Follow for more: https://whatsapp.com/channel/0029VbDetsPGufIx3Totk938`;

    const sent = thumb
      ? await sendWAImage(thumb, caption)
      : await sendWAText(caption);

    console.log(`[WA VideoBot] ${sent ? '✅' : '❌'} Posted video: "${title.slice(0, 50)}"`);
  } catch (e) {
    console.error('[WA VideoBot] Error:', e.message);
  }
}

// ─── Cron initializer — call this from server.js ───────────────────────────

function initWhatsAppBots(pool) {
  if (!process.env.GREENAPI_TOKEN || !process.env.WHATSAPP_CHANNEL_ID) {
    console.log('[WA Bots] GREENAPI_TOKEN or WHATSAPP_CHANNEL_ID not set — bots disabled');
    return;
  }

  console.log('📲 [WA Bots] Starting WhatsApp channel bots...');

  // Bot 1: News every 30 min
  runNewsPublisherBot(pool);
  setInterval(() => runNewsPublisherBot(pool), 30 * 60 * 1000);

  // Bot 2: Sports check every 5 min
  runSportsNotifierBot(pool);
  setInterval(() => runSportsNotifierBot(pool), 5 * 60 * 1000);

  // Bot 3: Trending videos every 2 hours
  runTrendingVideosBot();
  setInterval(() => runTrendingVideosBot, 2 * 60 * 60 * 1000);

  console.log('📲 [WA Bots] All three bots running');
}

module.exports = { initWhatsAppBots, runNewsPublisherBot, runSportsNotifierBot, runTrendingVideosBot };
