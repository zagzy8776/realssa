const cron = require('node-cron');
const Parser = require('rss-parser');
const { ingestAllFeeds } = require('./ingestion');
const { generateSocialHooks } = require('./summariser');
const { postToBuffer } = require('./buffer');

const SITE_URL = 'https://realssanews.com.ng';

// Initialize RSS Parser
const rssParser = new Parser({
  timeout: 10000,
  customFields: {
    item: [
      ['media:content', 'media:content', { keepArray: true }],
      ['media:thumbnail', 'media:thumbnail', { keepArray: true }],
      ['content:encoded', 'content:encoded'],
      ['description', 'description'],
      ['summary', 'summary']
    ],
  }
});

let pool;

// The 48-Hour Auto-Delete Garbage Collector (Zero-Cost Engine)
async function cleanOldArticles() {
  try {
    console.log(`[${new Date().toISOString()}] 🧹 Running 48-Hour Garbage Collector...`);
    const result = await pool.query(
      `DELETE FROM rss_articles WHERE published_at < NOW() - INTERVAL '2 days'`
    );
    console.log(`[${new Date().toISOString()}] 🗑️ Garbage Collector removed ${result.rowCount} old articles.`);
  } catch (err) {
    console.error('❌ Garbage Collector failed:', err.message);
  }
}

// Compile Daily Digest package (Top 20 stories under 200KB)
async function generateDailyDigest() {
  try {
    console.log(`[${new Date().toISOString()}] 📦 Compiling Daily Digest package...`);
    const result = await pool.query(
      `SELECT 'rss-' || id as id,
              title,
              COALESCE(ai_summary, original_excerpt) AS excerpt,
              category,
              image,
              published_at as date,
              source_name as author
       FROM rss_articles
       WHERE image IS NOT NULL AND image != ''
       ORDER BY published_at DESC
       LIMIT 20`
    );

    const digestArticles = result.rows.map(row => {
      let elegantExcerpt = '';
      if (row.excerpt) {
        const rawExcerpt = row.excerpt.trim();
        if (rawExcerpt.length <= 140) {
          elegantExcerpt = rawExcerpt;
        } else {
          const sliced = rawExcerpt.slice(0, 140);
          const lastSpace = sliced.lastIndexOf(' ');
          elegantExcerpt = lastSpace > 0 ? sliced.slice(0, lastSpace).trim() + '...' : sliced + '...';
        }
      }
      return {
        id: row.id,
        title: row.title,
        excerpt: elegantExcerpt,
        category: row.category,
        image: row.image,
        date: row.date,
        author: row.author
      };
    });

    const fs = require('fs');
    const path = require('path');
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const digestPath = path.join(dataDir, 'daily_digest.json');
    fs.writeFileSync(digestPath, JSON.stringify(digestArticles, null, 2));
    console.log(`[${new Date().toISOString()}] 📦 Daily Digest compiled successfully at ${digestPath}`);
  } catch (err) {
    console.error('❌ Daily Digest compilation failed:', err.message);
  }
}

// How many posts to keep loaded in Buffer's queue at all times
const BUFFER_QUEUE_TARGET = 10;
// Max posts to ADD per cron cycle (2 req/min for AI safety)
const BUFFER_MAX_PER_CYCLE = 2;
// Gap between each post in ms — 30s = 2 req/min
const BUFFER_POST_GAP_MS = 30000;

async function getBufferQueueCount() {
  try {
    const { getBufferProfiles } = require('./buffer');
    const { isBufferConfigured } = require('./buffer');
    if (!isBufferConfigured()) return 0;

    const BUFFER_ACCESS_TOKEN = process.env.BUFFER_ACCESS_TOKEN || process.env.BUFFER_S_TOKEN;
    const BUFFER_PROFILE_IDS = (process.env.BUFFER_PROFILE_IDS || process.env.BUFFER_FILE_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!BUFFER_PROFILE_IDS.length) return 0;

    // Check queue count for the first non-Instagram profile
    const INSTAGRAM_ID = '6a5c8546e2638b94d7959a2c';
    const checkId = BUFFER_PROFILE_IDS.find(id => id !== INSTAGRAM_ID) || BUFFER_PROFILE_IDS[0];

    const query = {
      query: `
        query GetQueuedPosts($channelId: ChannelId!) {
          channel(id: $channelId) {
            posts(filter: { status: scheduled }) {
              edges { node { id } }
            }
          }
        }
      `,
      variables: { channelId: checkId }
    };

    const res = await fetch('https://api.buffer.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${BUFFER_ACCESS_TOKEN}` },
      body: JSON.stringify(query)
    });

    if (!res.ok) return 0;
    const data = await res.json();
    return data?.data?.channel?.posts?.edges?.length ?? 0;
  } catch {
    return 0;
  }
}

async function runBufferCron() {
  try {
    console.log(`[Buffer Cron] Starting Buffer post cycle...`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS buffer_posts_log (
        id SERIAL PRIMARY KEY,
        story_hash TEXT UNIQUE,
        posted_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Check how many posts are already queued in Buffer
    const queueCount = await getBufferQueueCount();
    const toAdd = Math.max(0, BUFFER_QUEUE_TARGET - queueCount);

    if (toAdd === 0) {
      console.log(`[Buffer Cron] Queue already has ${queueCount} posts. Nothing to add.`);
      return;
    }

    console.log(`[Buffer Cron] Queue has ${queueCount} posts. Topping up with ${toAdd} more...`);

    // Balanced selection: guarantees 50% Nigerian news mix in Buffer queue
    const ngnLimit = Math.ceil(BUFFER_MAX_PER_CYCLE / 2); // 1 for Nigerian news
    const otherLimit = BUFFER_MAX_PER_CYCLE - ngnLimit;  // 1 for World/Sports/Other

    const ngnRes = await pool.query(
      `SELECT a.id, a.title, a.original_excerpt, a.ai_summary, a.image,
              a.external_link, a.category,
              COALESCE(a.story_hash, a.url_hash) AS story_hash
       FROM rss_articles a
       LEFT JOIN buffer_posts_log b ON b.story_hash = COALESCE(a.story_hash, a.url_hash)
       WHERE b.story_hash IS NULL
         AND COALESCE(a.story_hash, a.url_hash) IS NOT NULL
         AND a.category = 'nigerian-news'
       ORDER BY a.published_at DESC
       LIMIT $1`,
      [ngnLimit]
    );

    const otherRes = await pool.query(
      `SELECT a.id, a.title, a.original_excerpt, a.ai_summary, a.image,
              a.external_link, a.category,
              COALESCE(a.story_hash, a.url_hash) AS story_hash
       FROM rss_articles a
       LEFT JOIN buffer_posts_log b ON b.story_hash = COALESCE(a.story_hash, a.url_hash)
       WHERE b.story_hash IS NULL
         AND COALESCE(a.story_hash, a.url_hash) IS NOT NULL
         AND a.category != 'nigerian-news'
       ORDER BY a.is_featured DESC, a.published_at DESC
       LIMIT $1`,
      [otherLimit]
    );

    let articlesToProcess = [...ngnRes.rows, ...otherRes.rows];

    // Fallback: fill remaining slots if either query returned fewer articles
    if (articlesToProcess.length < BUFFER_MAX_PER_CYCLE) {
      const alreadyPickedHashes = new Set(articlesToProcess.map(a => a.story_hash));
      const fallbackRes = await pool.query(
        `SELECT a.id, a.title, a.original_excerpt, a.ai_summary, a.image,
                a.external_link, a.category,
                COALESCE(a.story_hash, a.url_hash) AS story_hash
         FROM rss_articles a
         LEFT JOIN buffer_posts_log b ON b.story_hash = COALESCE(a.story_hash, a.url_hash)
         WHERE b.story_hash IS NULL
           AND COALESCE(a.story_hash, a.url_hash) IS NOT NULL
         ORDER BY a.published_at DESC
         LIMIT 20`
      );

      for (const row of fallbackRes.rows) {
        if (!alreadyPickedHashes.has(row.story_hash)) {
          articlesToProcess.push(row);
          alreadyPickedHashes.add(row.story_hash);
          if (articlesToProcess.length >= BUFFER_MAX_PER_CYCLE) break;
        }
      }
    }

    if (articlesToProcess.length === 0) {
      console.log(`[Buffer Cron] No unposted articles found.`);
      return;
    }

    console.log(`[Buffer Cron] Processing ${articlesToProcess.length} articles this cycle (Categories: ${articlesToProcess.map(a => a.category).join(', ')}).`);

    for (const article of articlesToProcess) {
      const excerpt = article.ai_summary || article.original_excerpt || '';
      const hooks = await generateSocialHooks(article.title, excerpt);

      const link = `${SITE_URL}/read?url=${encodeURIComponent(article.external_link)}`;
      const success = await postToBuffer(hooks, link, article.image);

      if (success) {
        await pool.query(
          `INSERT INTO buffer_posts_log (story_hash) VALUES ($1) ON CONFLICT DO NOTHING`,
          [article.story_hash]
        );
        console.log(`[Buffer Cron] ✅ Queued: "${article.title.slice(0, 60)}"`);
      }

      // 30s gap = 2 req/min, safe for all AI providers
      await new Promise(r => setTimeout(r, BUFFER_POST_GAP_MS));
    }
  } catch (err) {
    console.error('[Buffer Cron] Error:', err.message);
  }
}


function initRssBot(sharedPool) {
  pool = sharedPool;
  console.log('🤖 RSS Aggregation Bot initialized. Running on Fly.io...');

  // Run every 20 minutes continuously
  cron.schedule('*/20 * * * *', async () => {
    try {
      console.log(`[${new Date().toISOString()}] Starting scheduled RSS ingestion cycle...`);
      const results = await ingestAllFeeds(pool, rssParser);
      console.log(`[${new Date().toISOString()}] Cycle complete. Added ${results.newCount} articles.`);
    } catch (err) {
      console.error('RSS Bot encountered an error during cycle:', err.message);
    }
  });

  // Check Buffer queue every 15 minutes — 2 posts per cycle = ~8 posts/hour, sustainable for all AI providers
  cron.schedule('*/15 * * * *', async () => {
    await runBufferCron();
  });

  // Run garbage collector every 1 hour (Minute 0)
  cron.schedule('0 * * * *', async () => {
    await cleanOldArticles();
  });

  // Run Daily Digest compiler every night at 02:00 UTC
  cron.schedule('0 2 * * *', async () => {
    await generateDailyDigest();
  });

  // Immediately run once on startup
  (async () => {
    try {
      console.log(`[${new Date().toISOString()}] Running initial RSS ingestion cycle...`);
      await ingestAllFeeds(pool, rssParser);
      await cleanOldArticles();
      await generateDailyDigest();
      await runBufferCron();
    } catch (err) {
      console.error('RSS Bot encountered an error during initial cycle:', err.message);
    }
  })();
}

module.exports = { initRssBot };

