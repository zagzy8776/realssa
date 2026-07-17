const cron = require('node-cron');
const Parser = require('rss-parser');
const { ingestAllFeeds } = require('./ingestion');

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
      `DELETE FROM rss_articles WHERE published_at < NOW() - INTERVAL '48 hours'`
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

function initRssBot(sharedPool) {
  pool = sharedPool;
  console.log('🤖 RSS Aggregation Bot initialized. Running on Fly.io...');

  // Run every 10 minutes continuously
  cron.schedule('*/10 * * * *', async () => {
    try {
      console.log(`[${new Date().toISOString()}] Starting scheduled RSS ingestion cycle...`);
      const results = await ingestAllFeeds(pool, rssParser);
      console.log(`[${new Date().toISOString()}] Cycle complete. Added ${results.newCount} articles.`);
    } catch (err) {
      console.error('RSS Bot encountered an error during cycle:', err.message);
    }
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
      await cleanOldArticles(); // Run cleanup on startup too
      await generateDailyDigest(); // Generate initial digest on startup
    } catch (err) {
      console.error('RSS Bot encountered an error during initial cycle:', err.message);
    }
  })();
}

module.exports = { initRssBot };

