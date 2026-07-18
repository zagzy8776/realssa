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

    // --- Added RealSSA Engagement & Hubs Migrations ---
    console.log('🔄 Running RealSSA Engagement & Hubs Migrations...');
    
    // 1. Alter live_matches for Hype Meter
    await pool.query(`
      ALTER TABLE live_matches 
        ADD COLUMN IF NOT EXISTS home_hype_count INT DEFAULT 0,
        ADD COLUMN IF NOT EXISTS away_hype_count INT DEFAULT 0;
    `);

    // 2. Alter rss_articles for Community Verification Counters
    await pool.query(`
      ALTER TABLE rss_articles 
        ADD COLUMN IF NOT EXISTS local_verified_count INT DEFAULT 0,
        ADD COLUMN IF NOT EXISTS rumor_flag_count INT DEFAULT 0;
    `);

    // 3. Create publishers table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS publishers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        logo_url TEXT,
        bio TEXT,
        wikipedia_url TEXT,
        follower_metrics JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 4. Create publisher_social_posts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS publisher_social_posts (
        id SERIAL PRIMARY KEY,
        publisher_id INT REFERENCES publishers(id) ON DELETE CASCADE,
        platform VARCHAR(20) NOT NULL,
        post_text TEXT NOT NULL,
        media_url TEXT,
        post_url TEXT,
        published_at TIMESTAMP WITH TIME ZONE NOT NULL,
        fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_publisher_posts_query ON publisher_social_posts (publisher_id, published_at DESC)');

    // 5. Create user_streaks table on usersPool
    await usersPool.query(`
      CREATE TABLE IF NOT EXISTS user_streaks (
        device_id VARCHAR(255) PRIMARY KEY,
        current_streak INT DEFAULT 1,
        longest_streak INT DEFAULT 1,
        last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 6. Create comments table on usersPool
    await usersPool.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        article_id VARCHAR(255) NOT NULL,
        parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
        author_name VARCHAR(100) NOT NULL,
        device_id VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        likes INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    await usersPool.query('CREATE INDEX IF NOT EXISTS idx_comments_article ON comments (article_id, created_at DESC)');

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
