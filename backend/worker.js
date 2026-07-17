const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
});

const usersDbUrl = process.env.USERS_DATABASE_URL || process.env.DATABASE_URL;
const usersPool = new Pool({
  connectionString: usersDbUrl,
  ssl: usersDbUrl ? { rejectUnauthorized: false } : undefined
});

async function runMigrations() {
  try {
    console.log('🔄 Running auto-migrations...');
    await pool.query('ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS story_hash VARCHAR(64)');

    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'rss_articles_story_hash_key'
        ) THEN
          ALTER TABLE rss_articles ADD CONSTRAINT rss_articles_story_hash_key UNIQUE (story_hash);
        END IF;
      END
      $$;
    `);

    // Create notified_articles table to handle notification deduplication and rate limits
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notified_articles (
        story_hash VARCHAR(64) PRIMARY KEY,
        notified_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Create user_category_affinities table for personalization engine on usersPool
    await usersPool.query(`
      CREATE TABLE IF NOT EXISTS user_category_affinities (
        device_id VARCHAR(64) NOT NULL,
        category VARCHAR(32) NOT NULL,
        score INT DEFAULT 0,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (device_id, category)
      );
    `);

    // Create user subscriptions and preferences on usersPool
    await usersPool.query(`
      CREATE TABLE IF NOT EXISTS user_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(100),
        endpoint TEXT UNIQUE NOT NULL,
        p256dh TEXT,
        auth TEXT,
        topics TEXT[] DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await usersPool.query(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        user_id VARCHAR(100) PRIMARY KEY,
        categories JSONB DEFAULT '[]',
        topics JSONB DEFAULT '[]',
        notification_settings JSONB DEFAULT '{}',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create index to optimize personalization lookup queries
    await usersPool.query('CREATE INDEX IF NOT EXISTS idx_user_category_affinities_lookup ON user_category_affinities (device_id, category)');

    // Create index for garbage collector optimization
    await pool.query('CREATE INDEX IF NOT EXISTS idx_rss_articles_published ON rss_articles (published_at)');

    // Create live scores and competitions tables on articlesPool
    await pool.query(`
      CREATE TABLE IF NOT EXISTS live_matches (
        match_id TEXT PRIMARY KEY,
        competition TEXT NOT NULL,
        home_team TEXT NOT NULL,
        away_team TEXT NOT NULL,
        home_score SMALLINT DEFAULT 0,
        away_score SMALLINT DEFAULT 0,
        status TEXT DEFAULT 'scheduled',
        match_minute SMALLINT,
        match_url TEXT,
        last_notified_score TEXT,
        kickoff_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_live_matches_status ON live_matches (status, updated_at DESC);');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS competitions (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        scrape_url TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        poll_seconds SMALLINT DEFAULT 60,
        tier SMALLINT DEFAULT 2
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS live_streams (
        id SERIAL PRIMARY KEY,
        match_id TEXT,
        match_title TEXT,
        home_team TEXT,
        away_team TEXT,
        stream_url TEXT NOT NULL,
        stream_type TEXT,
        quality TEXT,
        language TEXT,
        is_live BOOLEAN DEFAULT true,
        is_verified BOOLEAN DEFAULT false,
        url_hash TEXT UNIQUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Create client_errors table for queryable logs on production crashes on usersPool
    await usersPool.query(`
      CREATE TABLE IF NOT EXISTS client_errors (
        id SERIAL PRIMARY KEY,
        device_id VARCHAR(64),
        message TEXT NOT NULL,
        stack TEXT,
        component_name VARCHAR(64),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log('✅ Migrations complete.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  }
}

async function start() {
  console.log('====================================');
  console.log('🤖 Unified Worker Started on Fly.io');

  await runMigrations();

  console.log('👉 Running Sports Livescore Bot');
  const { initSportsBot } = require('./services/sportsBot');
  const notificationService = require('./services/notificationService');
  initSportsBot(pool, notificationService);

  console.log('👉 Running RSS News Aggregator');
  const { initRssBot } = require('./services/rssBot');
  initRssBot(pool);
  console.log('====================================');
}

// Export runMigrations so server.js can reuse it (single-process deployments).
module.exports = { runMigrations };

// Only auto-start when run directly (e.g. as the `worker` process), not when
// required by server.js.
if (require.main === module) {
  start();
}
