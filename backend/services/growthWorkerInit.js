const { Pool } = require('pg');
const { initGrowthServices } = require('./growthWorker');

// Initialize growth services on startup
async function initGrowthServices() {
  console.log('🚀 Initializing Growth Services...');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Prepare database tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS growth_runs (
        id BIGSERIAL PRIMARY KEY,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        finished_at TIMESTAMPTZ,
        status TEXT NOT NULL DEFAULT 'running',
        report JSONB
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS growth_images (
        article_id INTEGER PRIMARY KEY REFERENCES rss_articles(id) ON DELETE CASCADE,
        attempts INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TIMESTAMPTZ DEFAULT NOW(),
        checked_at TIMESTAMPTZ,
        error TEXT
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS growth_feeds (
        url TEXT NOT NULL,
        country TEXT NOT NULL,
        language TEXT,
        origin TEXT NOT NULL,
        healthy BOOLEAN,
        items INTEGER DEFAULT 0,
        failures INTEGER DEFAULT 0,
        checked_at TIMESTAMPTZ,
        next_check_at TIMESTAMPTZ DEFAULT NOW(),
        error TEXT,
        PRIMARY KEY(url,country)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS growth_stories (
        article_id INTEGER PRIMARY KEY REFERENCES rss_articles(id) ON DELETE CASCADE,
        cluster_id TEXT NOT NULL,
        context JSONB NOT NULL,
        draft JSONB,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await pool.query('CREATE INDEX IF NOT EXISTS growth_stories_cluster ON growth_stories(cluster_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS growth_feeds_due ON growth_feeds(next_check_at)');

    // Insert initial feeds if not exist
    try {
      const registry = require('../data/world_feeds.json');
      const seeds = Object.entries(registry).flatMap(([country,data]) =>
        (data.urls || (data.url ? [data.url] : [])).map(url => ({url,country,language:data.language || null})));
      await pool.query(
        "INSERT INTO growth_feeds(url,country,language,origin) SELECT url,country,language,'registry' FROM jsonb_to_recordset($1::jsonb) AS x(url text,country text,language text) ON CONFLICT DO NOTHING",
        [JSON.stringify(seeds)]
      );
    } catch (err) {
      console.error('Failed to seed initial feeds:', err.message);
    }

    // Initialize feed_quality_scores table for distribution ranking
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS feed_quality_scores (
          article_id INTEGER PRIMARY KEY REFERENCES rss_articles(id) ON DELETE CASCADE,
          word_count INTEGER DEFAULT 0,
          image_count INTEGER DEFAULT 0,
          video_count INTEGER DEFAULT 0,
          quality_score NUMERIC(5,2) DEFAULT 0,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_feed_quality_scores ON feed_quality_scores (quality_score DESC, updated_at DESC);
      `);
      console.log('✅ Feed quality scoring table created for distribution ranking.');
    } catch (err) {
      console.error('Failed to create feed_quality_scores table:', err.message);
    }

    console.log('✅ Growth Services initialized successfully');
    return true;
  } catch (err) {
    console.error('❌ Failed to initialize Growth Services:', err.message);
    return false;
  } finally {
    await pool.end();
  }
}

module.exports = { initGrowthServices };