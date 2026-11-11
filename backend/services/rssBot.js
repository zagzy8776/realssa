const cron = require('node-cron');
const Parser = require('rss-parser');
const { ingestAllFeeds } = require('./ingestion');
const { generateSocialHooks } = require('./summariser');
const { postToBuffer } = require('./buffer');
const { postToTelegramChannel } = require('./telegramPublisher');

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

// The 48-Hour Auto-Delete Garbage Collector across ALL 5 Databases
async function cleanOldArticles() {
  try {
    console.log(`[${new Date().toISOString()}] 🧹 Running 48-Hour Garbage Collector across all 5 databases...`);
    const { getAllPools } = require('../config/multiDb');
    const allPools = getAllPools();
    let totalPurged = 0;
    for (const item of allPools) {
      try {
        // Stage 1: Free up space by clearing out heavy columns older than 24 hours
        await item.pool.query(
          `UPDATE rss_articles 
           SET full_content = NULL, 
               embedding = NULL, 
               title_translations = NULL, 
               summary_translations = NULL 
           WHERE published_at < NOW() - INTERVAL '24 hours'`
        );

        // Clean out full rows older than 24 hours (1 day retention)
        const result = await item.pool.query(
          `DELETE FROM rss_articles WHERE published_at < NOW() - INTERVAL '24 hours'`
        );
        totalPurged += result.rowCount || 0;
        if (result.rowCount > 0) {
          console.log(`[${new Date().toISOString()}] 🗑️ Garbage Collector removed ${result.rowCount} articles older than 24 hours from ${item.name}.`);
        }
      } catch (pErr) {
        console.warn(`[Garbage Collector Warning on ${item.name}]: ${pErr.message}`);
      }
    }
    console.log(`[${new Date().toISOString()}] 🗑️ Total 24-Hour Garbage Collection complete: ${totalPurged} old articles removed.`);
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
// Max posts to ADD per cron cycle (2 req/cycle = sustainable for Buffer API 15m rate limit)
const BUFFER_MAX_PER_CYCLE = 2;
// Keep the local/Fly worker conservative. A Vercel Cron invocation has a
// finite function lifetime, so use a short, configurable gap there instead.
const BUFFER_POST_GAP_MS = Number(
  process.env.BUFFER_POST_GAP_MS ?? (process.env.VERCEL ? 1000 : 30000)
);

async function getBufferQueueCount() {
  try {
    const { isBufferConfigured } = require('./buffer');
    if (!isBufferConfigured()) return 0;

    const BUFFER_ACCESS_TOKEN = process.env.BUFFER_ACCESS_TOKEN || process.env.BUFFER_S_TOKEN || 'XgC6VYuJXL4xvvPRJolhwEdpK5iC4xwJutuSVPqf7Aw';
    const rawProfiles = process.env.BUFFER_PROFILE_IDS || process.env.BUFFER_FILE_IDS || '6a5c8546e2638b94d7959a2c,6a46f43d5ab6d2f1069abed2';
    const BUFFER_PROFILE_IDS = rawProfiles.split(',').map(s => s.trim()).filter(Boolean);
    if (!BUFFER_PROFILE_IDS.length) return 0;

    // Check queue count for the first non-Instagram profile
    const INSTAGRAM_ID = '6a5c8546e2638b94d7959a2c';
    const checkId = BUFFER_PROFILE_IDS.find(id => id !== INSTAGRAM_ID) || BUFFER_PROFILE_IDS[0];

    // Step 1: Get Organization ID
    const orgRes = await fetch('https://api.buffer.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${BUFFER_ACCESS_TOKEN}` },
      body: JSON.stringify({
        query: `query GetOrganizations { account { organizations { id } } }`
      })
    });
    if (!orgRes.ok) return 0;
    const orgData = await orgRes.json();
    const orgId = orgData?.data?.account?.organizations?.[0]?.id;
    if (!orgId) return 0;

    // Step 2: Query scheduled posts
    const postsQuery = {
      query: `
        query GetQueuedPosts($input: PostsInput!) {
          posts(input: $input) {
            edges {
              node {
                id
                status
              }
            }
          }
        }
      `,
      variables: {
        input: {
          organizationId: orgId,
          filter: {
            channelIds: [checkId],
            status: ['scheduled']
          }
        }
      }
    };

    const res = await fetch('https://api.buffer.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${BUFFER_ACCESS_TOKEN}` },
      body: JSON.stringify(postsQuery)
    });

    if (!res.ok) return 0;
    const data = await res.json();
    return data?.data?.posts?.edges?.length ?? 0;
  } catch {
    return 0;
  }
}

function getDbPool() {
  if (pool) return pool;
  try {
    const { pools } = require('../config/multiDb');
    if (pools && pools[0] && pools[0].pool) {
      pool = pools[0].pool;
      return pool;
    }
  } catch (e) { }
  return null;
}

async function runBufferCron() {
  const db = getDbPool();
  if (!db) {
    console.error('[Buffer Cron] Failed: Database pool unavailable.');
    return { ok: false, status: 503, code: 'DATABASE_UNAVAILABLE', message: 'Database pool unavailable.' };
  }

  let client;
  try {
    // Advisory locks belong to a PostgreSQL session. Hold one checked-out
    // client for the entire cycle so the same session also releases the lock.
    client = await db.connect();
    // Acquire PostgreSQL advisory lock to ensure only 1 worker runs Buffer top-up at a time
    const lockRes = await client.query(`SELECT pg_try_advisory_lock(888777) AS acquired`);
    if (!lockRes.rows[0]?.acquired) {
      console.log('[Buffer Cron] Another worker is running Buffer top-up. Skipping concurrent execution.');
      return { ok: true, skipped: true, message: 'Another Buffer cycle is already running.' };
    }

    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS buffer_posts_log (
          id SERIAL PRIMARY KEY,
          story_hash TEXT UNIQUE,
          title_clean TEXT,
          posted_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await client.query(`ALTER TABLE buffer_posts_log ADD COLUMN IF NOT EXISTS title_clean TEXT`).catch(() => { });

      // Check how many posts are already queued in Buffer
      const queueCount = await getBufferQueueCount();
      const toAdd = Math.max(0, BUFFER_QUEUE_TARGET - queueCount);

      if (toAdd === 0) {
        console.log(`[Buffer Cron] Queue already has ${queueCount} posts. Nothing to add.`);
        return { ok: true, queued: 0, message: `Buffer queue already has ${queueCount} posts.` };
      }

      console.log(`[Buffer Cron] Queue has ${queueCount} posts. Topping up with ${toAdd} more...`);

      // Balanced selection: guarantees 50% Nigerian news mix in Buffer queue
      const ngnLimit = Math.ceil(BUFFER_MAX_PER_CYCLE / 2); // 3 for Nigerian news
      const otherLimit = BUFFER_MAX_PER_CYCLE - ngnLimit;  // 2 for World/Sports/Other

      const ngnRes = await client.query(
        `SELECT a.title, a.original_excerpt, a.ai_summary, a.full_content, a.image,
                a.external_link, a.category,
                a.url_hash AS story_hash
         FROM rss_articles a
         LEFT JOIN buffer_posts_log b ON b.story_hash = a.url_hash
         WHERE b.story_hash IS NULL
           AND a.url_hash IS NOT NULL
           AND a.category = 'nigerian-news'
         ORDER BY a.published_at DESC
         LIMIT $1`,
        [ngnLimit]
      );

      const otherRes = await client.query(
        `SELECT a.title, a.original_excerpt, a.ai_summary, a.full_content, a.image,
                a.external_link, a.category,
                a.url_hash AS story_hash
         FROM rss_articles a
         LEFT JOIN buffer_posts_log b ON b.story_hash = a.url_hash
         WHERE b.story_hash IS NULL
           AND a.url_hash IS NOT NULL
           AND a.category != 'nigerian-news'
         ORDER BY a.is_featured DESC, a.published_at DESC
         LIMIT $1`,
        [otherLimit]
      );

      let articlesToProcess = [...ngnRes.rows, ...otherRes.rows];

      // Fallback: fill remaining slots if either query returned fewer articles
      if (articlesToProcess.length < BUFFER_MAX_PER_CYCLE) {
        const alreadyPickedHashes = new Set(articlesToProcess.map(a => a.story_hash));
        const fallbackRes = await client.query(
          `SELECT a.title, a.original_excerpt, a.ai_summary, a.full_content, a.image,
                  a.external_link, a.category,
                  a.url_hash AS story_hash
           FROM rss_articles a
           LEFT JOIN buffer_posts_log b ON b.story_hash = a.url_hash
           WHERE b.story_hash IS NULL
             AND a.url_hash IS NOT NULL
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
        return { ok: true, queued: 0, message: 'No unposted articles found.' };
      }

      console.log(`[Buffer Cron] Processing ${articlesToProcess.length} articles this cycle (Categories: ${articlesToProcess.map(a => a.category).join(', ')}).`);

      let queued = 0;
      for (const article of articlesToProcess) {
        const cleanTitle = article.title.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
        const first5Words = cleanTitle.split(' ').slice(0, 5).join(' ');

        // Deduplication check across similar titles
        const dupCheck = await client.query(
          `SELECT 1 FROM buffer_posts_log WHERE title_clean = $1 OR (title_clean IS NOT NULL AND title_clean LIKE $2) LIMIT 1`,
          [cleanTitle, `${first5Words}%`]
        );

        if (dupCheck.rows.length > 0) {
          console.log(`[Buffer Cron] ⏭️ Skipping duplicate title: "${article.title.slice(0, 50)}..."`);
          // Mark hash as posted so we don't inspect it again
          await client.query(`INSERT INTO buffer_posts_log (story_hash, title_clean) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [article.story_hash, cleanTitle]).catch(() => { });
          continue;
        }

        // Prefer the extracted article body so social copy is grounded in more
        // than an RSS teaser; fall back safely for feeds without full content.
        const excerpt = article.full_content || article.ai_summary || article.original_excerpt || '';
        const hooks = await generateSocialHooks(article.title, excerpt);

        const link = `${SITE_URL}/read?url=${encodeURIComponent(article.external_link)}`;
        const success = await postToBuffer(hooks, link, article.image, false);

        if (success) {
          await client.query(
            `INSERT INTO buffer_posts_log (story_hash, title_clean) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [article.story_hash, cleanTitle]
          );
          queued += 1;
          console.log(`[Buffer Cron] ✅ Queued: "${article.title.slice(0, 60)}"`);

          // Auto-broadcast to Telegram Channel
          postToTelegramChannel({
            id: article.id || article.story_hash,
            title: article.title,
            excerpt: article.original_excerpt || article.excerpt,
            ai_summary: article.ai_summary,
            category: article.category,
            image: article.image,
            readTime: '3 min read'
          }).catch(err => {
            console.warn('[TelegramPublisher] RSS auto-post error:', err.message);
          });
        }

        // 30s gap = 2 req/min, safe for all AI providers
        await new Promise(r => setTimeout(r, BUFFER_POST_GAP_MS));
      }
      return { ok: true, queued, attempted: articlesToProcess.length };
    } finally {
      await client.query(`SELECT pg_advisory_unlock(888777)`).catch(() => { });
    }
  } catch (err) {
    console.error('[Buffer Cron] Error:', err.message);
    return {
      ok: false,
      status: err.status || 500,
      code: err.code || 'BUFFER_CRON_FAILED',
      message: err.message,
    };
  } finally {
    client?.release();
  }
}


function initRssBot(sharedPool) {
  pool = sharedPool;
  console.log('🤖 RSS Aggregation Bot initialized. Running on Fly.io...');

  // Trigger initial Buffer post cycle on startup after 10s delay
  setTimeout(async () => {
    try {
      console.log('[Buffer Startup] Initializing automatic Buffer post cycle...');
      await runBufferCron();
    } catch (err) {
      console.error('[Buffer Startup] Error:', err.message);
    }
  }, 10000);

  // Run every 15 minutes continuously
  cron.schedule('*/15 * * * *', async () => {
    try {
      console.log(`[${new Date().toISOString()}] Starting scheduled RSS ingestion cycle...`);
      const results = await ingestAllFeeds(pool, rssParser);
      console.log(`[${new Date().toISOString()}] Cycle complete. Added ${results?.newCount || 0} articles.`);

      // Automatically trigger Buffer social post cycle after RSS ingestion
      await runBufferCron();
    } catch (err) {
      console.error('RSS Bot encountered an error during cycle:', err.message);
    }
  });

  // Check Buffer queue every 15 minutes — 2 posts per cycle = sustainable for Buffer API 15m rate limit
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

  // Immediately run Buffer top-up and ingestion on startup in parallel
  (async () => {
    try {
      console.log(`[${new Date().toISOString()}] Triggering instant Buffer queue top-up on startup...`);
      runBufferCron().catch(err => console.error('Initial Buffer error:', err));

      console.log(`[${new Date().toISOString()}] Running initial RSS ingestion cycle...`);
      await ingestAllFeeds(pool, rssParser);
      await cleanOldArticles();
      await generateDailyDigest();
    } catch (err) {
      console.error('RSS Bot encountered an error during initial cycle:', err.message);
    }
  })();
}

module.exports = { initRssBot, runBufferCron };
