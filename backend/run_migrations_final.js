// Run all migrations to set up the feed scale-out system
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const migrations = [
  `CREATE TABLE IF NOT EXISTS feed_health (
    feed_url TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    last_success TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    error_count INTEGER DEFAULT 0,
    avg_response_ms INTEGER DEFAULT 0,
    articles_last_24h INTEGER DEFAULT 0,
    articles_7d INTEGER DEFAULT 0,
    avg_latency_ms INTEGER DEFAULT 0,
    success_rate NUMERIC(5,4) DEFAULT 0,
    quality_score NUMERIC(5,2) DEFAULT 0,
    last_articles_at TIMESTAMPTZ
  );`,
  `CREATE TABLE IF NOT EXISTS feed_schedule (
    category TEXT PRIMARY KEY,
    tier SMALLINT DEFAULT 2,
    last_ingested_at TIMESTAMPTZ,
    failure_count INTEGER DEFAULT 0,
    quarantined_until TIMESTAMPTZ,
    weight NUMERIC(6,4) DEFAULT 1.0,
    discovered_via TEXT
  );`,
  `CREATE INDEX IF NOT EXISTS idx_feed_schedule_tier_ts
   ON feed_schedule (tier, last_ingested_at ASC NULLS FIRST);`,
  `CREATE TABLE IF NOT EXISTS feed_discoveries (
    url TEXT PRIMARY KEY,
    country TEXT NOT NULL,
    source_url TEXT,
    discovered_at TIMESTAMPTZ DEFAULT NOW(),
    validated BOOLEAN DEFAULT false,
    validated_at TIMESTAMPTZ,
    rejection_reason TEXT,
    attempts INTEGER DEFAULT 0,
    next_attempt_at TIMESTAMPTZ DEFAULT NOW()
  );`,
  `CREATE INDEX IF NOT EXISTS idx_feed_discoveries_pending
   ON feed_discoveries (next_attempt_at)
   WHERE validated IS false;`,
  `ALTER TABLE rss_articles
   ADD COLUMN IF NOT EXISTS source_credibility_score INTEGER DEFAULT 70,`,
  `ADD COLUMN IF NOT EXISTS word_count INTEGER DEFAULT 0,`,
  `ADD COLUMN IF NOT EXISTS image_count INTEGER DEFAULT 0,`,
  `ADD COLUMN IF NOT EXISTS video_count INTEGER DEFAULT 0,`,
  `ADD COLUMN IF NOT EXISTS quality_score NUMERIC(5,2) DEFAULT 0;`,
  `CREATE INDEX IF NOT EXISTS idx_articles_quality
   ON rss_articles (quality_score DESC, published_at DESC);`,
  `CREATE TABLE IF NOT EXISTS buffer_posts_log (
    story_hash VARCHAR(64) PRIMARY KEY,
    posted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );`
];

async function runAllMigrations() {
  console.log('Running feed scale-out migrations...');
  try {
    for (const sql of migrations) {
      try {
        await pool.query(sql);
        console.log('OK:', sql.substring(0, 60));
      } catch (err) {
        console.error('FAIL:', err.message);
        console.error('SQL:', sql.substring(0, 200));
      }
    }
    console.log('All migrations complete.');
  } finally {
    await pool.end();
  }
}

runAllMigrations().catch(err => {
  console.error('Migrations failed:', err);
  process.exit(1);
});