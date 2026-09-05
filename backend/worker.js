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

const { initAllDatabases } = require('./init_all_dbs');
const { initAiDatabase } = require('./init_ai_db');

async function runMigrations() {
  try {
    console.log('🔄 Running multi-database auto-migrations...');
    await initAllDatabases();
    await initAiDatabase();

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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS notified_articles (
        story_hash VARCHAR(64) PRIMARY KEY,
        notified_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await usersPool.query(`
      CREATE TABLE IF NOT EXISTS user_category_affinities (
        device_id VARCHAR(64) NOT NULL,
        category VARCHAR(32) NOT NULL,
        score INT DEFAULT 0,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (device_id, category)
      );
    `);

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

    await usersPool.query('CREATE INDEX IF NOT EXISTS idx_user_category_affinities_lookup ON user_category_affinities (device_id, category)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_rss_articles_published ON rss_articles (published_at)');

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

    await pool.query(`
      ALTER TABLE live_matches
        ADD COLUMN IF NOT EXISTS home_hype_count INT DEFAULT 0,
        ADD COLUMN IF NOT EXISTS away_hype_count INT DEFAULT 0;
    `);

    await pool.query(`
      ALTER TABLE rss_articles
        ADD COLUMN IF NOT EXISTS local_verified_count INT DEFAULT 0,
        ADD COLUMN IF NOT EXISTS rumor_flag_count INT DEFAULT 0;
    `);

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

    await usersPool.query(`
      CREATE TABLE IF NOT EXISTS user_streaks (
        device_id VARCHAR(255) PRIMARY KEY,
        current_streak INT DEFAULT 1,
        longest_streak INT DEFAULT 1,
        last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Canonical community comments schema. Keep this migration additive so existing comments survive.
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
      ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT false;
      ALTER TABLE comments ADD COLUMN IF NOT EXISTS bot_key VARCHAR(80);
      CREATE INDEX IF NOT EXISTS idx_comments_article ON comments (article_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_comments_bot_article ON comments (article_id, bot_key) WHERE is_bot = true;
      CREATE UNIQUE INDEX IF NOT EXISTS uq_comments_bot_article
        ON comments (article_id, bot_key)
        WHERE is_bot = true AND bot_key IS NOT NULL;
      UPDATE comments
      SET is_bot = true, bot_key = 'legacy-simulation'
      WHERE COALESCE(is_bot, false) = false
        AND device_id LIKE 'simulated-bot-%';
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS source_credibility (
        source_name VARCHAR(255) PRIMARY KEY,
        credibility_score INTEGER NOT NULL DEFAULT 70
      );
    `);

    await pool.query(`
      INSERT INTO source_credibility (source_name, credibility_score) VALUES
        ('BBC Africa', 95), ('BBC News', 95), ('Premium Times', 95),
        ('Al Jazeera English', 95), ('The Guardian Nigeria', 95),
        ('Channels TV', 85), ('Vanguard', 85), ('TheCable', 85),
        ('Nairametrics', 85), ('Daily Trust', 85), ('BusinessDay', 85),
        ('SuperSport', 85)
      ON CONFLICT (source_name) DO UPDATE SET credibility_score = EXCLUDED.credibility_score;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS feed_health (
        feed_url TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        last_success TIMESTAMP WITH TIME ZONE,
        last_error TEXT,
        error_count INTEGER DEFAULT 0,
        avg_response_ms INTEGER DEFAULT 0,
        articles_last_24h INTEGER DEFAULT 0
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS buffer_posts_log (
        story_hash VARCHAR(64) PRIMARY KEY,
        posted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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

  console.log('👉 Running Rates Bot (ExchangeRate-API official rates)');
  const { initRatesBot } = require('./services/ratesBot');
  initRatesBot(pool);

  console.log('👉 Running Prices Bot (NBS commodity prices)');
  const { initPricesBot } = require('./services/pricesBot');
  initPricesBot(pool);

  console.log('👉 Running Discussion Bot (transparent official prompts)');
  const { initDiscussionBot } = require('./services/discussionBot');
  initDiscussionBot();

  console.log('====================================');
}

module.exports = { runMigrations };

if (require.main === module) {
  start();
}