const crypto = require('crypto');
const fetch = require('node-fetch');
const { mapStreamToMatch } = require('./matchMapper');

// Simulates fetching live stream URLs from sources
// In a real production crawler, you would use Puppeteer/Cheerio to scrape actual stream index sites.
// For demonstration, we'll implement a mock crawler that injects valid HLS testing streams and maps them.

async function runCrawler(pool) {
  console.log('[Crawler] Starting stream discovery...');
  try {
    // 1. Fetch sources from DB (mocked below)
    // const result = await pool.query("SELECT * FROM stream_sources WHERE is_active = true");
    // const sources = result.rows;

    // Simulated discovered streams from scraping (BIG MATCH OVERRIDES)
    const discoveredStreams = [
      {
        title: 'World Cup 2026: Nigeria vs Brazil Live',
        url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', // Real HLS test stream
        type: 'hls',
        quality: '4K',
        language: 'EN'
      },
      {
        title: 'Arsenal vs Chelsea Live',
        url: 'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8', // Real HLS test stream
        type: 'hls',
        quality: '1080p',
        language: 'EN'
      },
      {
        title: 'Real Madrid vs Barcelona',
        url: 'https://www.youtube.com/embed/gCNeDWCI0vo', // Al Jazeera live as a fallback iframe test
        type: 'iframe',
        quality: '720p',
        language: 'ES'
      }
    ];

    // 1B. Fetch Open-Source IPTV Sports Channels (Option B)
    try {
      console.log('[Crawler] Fetching open-source IPTV sports channels...');
      const response = await fetch('https://iptv-org.github.io/iptv/categories/sports.m3u');
      const text = await response.text();
      const lines = text.split('\n');
      
      let channelCount = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('#EXTINF')) {
          const titleParts = lines[i].split(',');
          const channelName = titleParts.length > 1 ? titleParts[1].trim() : 'Unknown Channel';
          const url = lines[i + 1] ? lines[i + 1].trim() : '';
          
          if (url && url.startsWith('http') && url.includes('.m3u8')) {
            discoveredStreams.push({
              title: channelName,
              url: url,
              type: 'hls',
              quality: 'HD',
              language: 'Various'
            });
            channelCount++;
            // Limit to 40 channels to prevent Vercel 10s timeout
            if (channelCount >= 40) break;
          }
        }
      }
      console.log(`[Crawler] Found ${channelCount} sports channels from IPTV source.`);
    } catch (err) {
      console.warn('[Crawler] Could not fetch IPTV playlist:', err.message);
    }

    let newCount = 0;

    // 2. Process and Map (in parallel)
    await Promise.all(discoveredStreams.map(async (stream) => {
      // Map stream to an actual match fixture using fuzzy matching
      const match = await mapStreamToMatch(stream.title);
      
      const match_id = match ? match.match_id : crypto.randomUUID();
      const match_title = match ? `${match.home_team} vs ${match.away_team}` : stream.title;
      const home_team = match ? match.home_team : 'Unknown';
      const away_team = match ? match.away_team : 'Unknown';

      const url_hash = crypto.createHash('sha256').update(stream.url).digest('hex');

      // 3. Upsert to Database
      const upsertResult = await pool.query(
        `INSERT INTO live_streams (match_id, match_title, home_team, away_team, stream_url, stream_type, quality, language, is_live, is_verified, url_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (url_hash) DO UPDATE SET 
           is_live = true,
           updated_at = NOW()
         RETURNING id`,
        [match_id, match_title, home_team, away_team, stream.url, stream.type, stream.quality, stream.language, true, true, url_hash]
      );

      if (upsertResult.rows.length > 0) {
        newCount++;
      }
    }));

    console.log(`[Crawler] Discovery complete. Upserted ${newCount} active streams.`);
  } catch (err) {
    console.error('[Crawler] Error running stream discovery:', err);
  }
}

module.exports = {
  runCrawler
};
