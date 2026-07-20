const cron = require('node-cron');
const Parser = require('rss-parser');
const { ingestAllFeeds } = require('./ingestion');
const { generateSocialHook } = require('./summariser');
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

    // Check daily limit
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM buffer_posts_log WHERE posted_at >= NOW() - INTERVAL '24 hours'`
    );
    const dailyCount = parseInt(countRes.rows[0].count, 10);

    if (dailyCount >= 10) {
      console.log(`[Buffer Cron] Daily limit reached (${dailyCount}/10). Skipping.`);
      return;
    }

    const remaining = 10 - dailyCount;

    // Pick best unposted articles from last 2 days — prioritise featured/recent
    const res = await pool.query(
      `SELECT a.id, a.title, a.original_excerpt, a.ai_summary, a.image,
              a.external_link, a.category, a.story_hash
       FROM rss_articles a
       LEFT JOIN buffer_posts_log b ON b.story_hash = a.story_hash
       WHERE b.story_hash IS NULL
         AND a.published_at > NOW() - INTERVAL '2 days'
         AND a.content_type = 'article'
       ORDER BY a.is_featured DESC, a.published_at DESC
       LIMIT $1`,
      [remaining]
    );

    if (res.rows.length === 0) {
      console.log(`[Buffer Cron] No unposted articles found.`);
      return;
    }

    console.log(`[Buffer Cron] Found ${res.rows.length} unposted articles. Daily count: ${dailyCount}/10.`);

    for (const article of res.rows) {
      const excerpt = article.ai_summary || article.original_excerpt || '';
      const hook = await generateSocialHook(article.title, excerpt);
      if (!hook) {
        console.warn(`[Buffer Cron] Gemini returned no hook for: "${article.title.slice(0, 50)}"`);
        continue;
      }

      const link = `${SITE_URL}/read?url=${encodeURIComponent(article.external_link)}`;
      const success = await postToBuffer(hook, link, article.image);

      if (success) {
        await pool.query(
          `INSERT INTO buffer_posts_log (story_hash) VALUES ($1) ON CONFLICT DO NOTHING`,
          [article.story_hash]
        );
        console.log(`[Buffer Cron] ✅ Posted: "${article.title.slice(0, 60)}"`);
      }

      // Small delay between posts to avoid hammering Buffer API
      await new Promise(r => setTimeout(r, 2000));
    }
  } catch (err) {
    console.error('[Buffer Cron] Error:', err.message);
  }
}


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

  // Run Buffer social posting every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
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

