require('dotenv').config();
const { queryMultiDb } = require('./config/multiDb');
const { generateSocialHooks } = require('./services/summariser');
const { postToBuffer } = require('./services/buffer');

const SITE_URL = 'https://realssanews.com.ng';
const BUFFER_MAX_PER_CYCLE = 2;
const BUFFER_POST_GAP_MS = 1000; // 1s for quick test

// Create a pool-like wrapper for the bot
const pool = { query: queryMultiDb };

async function forceRunBufferCron() {
  console.log(`[Buffer Test] Force starting Buffer posting cycle...`);
  try {
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
       LIMIT 1`
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
       ORDER BY a.published_at DESC
       LIMIT 1`
    );

    let articlesToProcess = [...ngnRes.rows, ...otherRes.rows];

    if (articlesToProcess.length === 0) {
      console.log(`[Buffer Cron] No unposted articles found in database.`);
      process.exit(0);
    }

    console.log(`[Buffer Cron] Found ${articlesToProcess.length} unposted articles. Processing...`);

    for (const article of articlesToProcess) {
      console.log(`\nSummarizing: "${article.title}"...`);
      const excerpt = article.ai_summary || article.original_excerpt || '';
      
      const hooks = await generateSocialHooks(article.title, excerpt);
      const link = `${SITE_URL}/read?url=${encodeURIComponent(article.external_link)}`;
      
      console.log(`Posting to Buffer...`);
      const success = await postToBuffer(hooks, link, article.image);

      if (success) {
        await pool.query(
          `INSERT INTO buffer_posts_log (story_hash) VALUES ($1) ON CONFLICT DO NOTHING`,
          [article.story_hash]
        );
        console.log(`✅ Success: Logged post for "${article.title.slice(0, 50)}..."`);
      } else {
        console.log(`❌ Failed to post.`);
      }

      await new Promise(r => setTimeout(r, BUFFER_POST_GAP_MS));
    }
    console.log('\n✅ Buffer force run complete.');
    process.exit(0);
  } catch (err) {
    console.error('Error running buffer test:', err);
    process.exit(1);
  }
}

forceRunBufferCron();
