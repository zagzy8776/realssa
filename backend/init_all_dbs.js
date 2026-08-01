require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getAllPools } = require('./config/multiDb');

async function initAllDatabases() {
  console.log('🚀 INITIALIZING SCHEMAS ACROSS ALL 4 DATABASES...\n');

  const rssSchemaPath = path.join(__dirname, 'rss_articles_schema.sql');
  const dbSchemaPath = path.join(__dirname, 'db_schema.sql');

  const rssSql = fs.existsSync(rssSchemaPath) ? fs.readFileSync(rssSchemaPath, 'utf8') : '';
  const dbSql = fs.existsSync(dbSchemaPath) ? fs.readFileSync(dbSchemaPath, 'utf8') : '';

  const pools = getAllPools();

  for (const item of pools) {
    console.log(`\n-----------------------------------------`);
    console.log(`Migrating: ${item.name}...`);
    try {
      if (rssSql) {
        await item.pool.query(rssSql);
        console.log(`  ✅ RSS Articles Schema (rss_articles_schema.sql) applied.`);
      }

      if (dbSql) {
        await item.pool.query(dbSql);
        console.log(`  ✅ Core Database Schema (db_schema.sql) applied.`);
      }

      // Supplementary columns & tables
      await item.pool.query(`
        ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS story_hash VARCHAR(64);
        ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS full_content TEXT;
        ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS title_translations JSONB;
        ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS summary_translations JSONB;
        ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS local_verified_count INT DEFAULT 0;
        ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS rumor_flag_count INT DEFAULT 0;
        ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS reaction_count INT DEFAULT 0;
        ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS freshness_score DOUBLE PRECISION DEFAULT 0;
        ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;
        ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS embedding TEXT;
        ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS image_status VARCHAR(16) NOT NULL DEFAULT 'pending';
        ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS image_checked_at TIMESTAMPTZ;
        ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS image_width INTEGER;
        ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS image_height INTEGER;

        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rss_articles_story_hash_key') THEN
            ALTER TABLE rss_articles ADD CONSTRAINT rss_articles_story_hash_key UNIQUE (story_hash);
          END IF;
        END $$;

        CREATE TABLE IF NOT EXISTS notified_articles (
          story_hash VARCHAR(64) PRIMARY KEY,
          notified_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS user_category_affinities (
          device_id VARCHAR(64) NOT NULL,
          category VARCHAR(32) NOT NULL,
          score INT DEFAULT 0,
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (device_id, category)
        );

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

        CREATE TABLE IF NOT EXISTS competitions (
          id SERIAL PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          slug TEXT UNIQUE NOT NULL,
          country TEXT,
          logo_url TEXT,
          scrape_url TEXT,
          priority INTEGER DEFAULT 10,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS feed_health (
          feed_url TEXT PRIMARY KEY,
          category TEXT NOT NULL,
          last_success TIMESTAMPTZ,
          last_error TEXT,
          error_count INT DEFAULT 0,
          avg_response_ms INT DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_rss_articles_published ON rss_articles (published_at DESC);
        CREATE INDEX IF NOT EXISTS idx_rss_articles_cat_pub ON rss_articles (category, published_at DESC);
        CREATE INDEX IF NOT EXISTS idx_rss_articles_image_status ON rss_articles (image_status, published_at DESC);

        CREATE TABLE IF NOT EXISTS cinema_movies (
          id INT PRIMARY KEY,
          title TEXT NOT NULL,
          overview TEXT,
          poster_path TEXT,
          backdrop_path TEXT,
          release_date TEXT,
          vote_average DOUBLE PRECISION DEFAULT 0,
          genres JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS cinema_shows (
          id INT PRIMARY KEY,
          name TEXT NOT NULL,
          overview TEXT,
          poster_path TEXT,
          backdrop_path TEXT,
          first_air_date TEXT,
          vote_average DOUBLE PRECISION DEFAULT 0,
          genres JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS cinema_sources (
          id SERIAL PRIMARY KEY,
          tmdb_id INT NOT NULL,
          media_type VARCHAR(16) NOT NULL,
          season INT DEFAULT 1,
          episode INT DEFAULT 1,
          sources JSONB NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_cinema_sources_media ON cinema_sources (tmdb_id, media_type, season, episode);
      `);

      console.log(`  ✅ Supplementary migrations & indexes successfully applied on ${item.name}.`);

    } catch (err) {
      console.error(`  ❌ Error migrating ${item.name}:`, err.message);
    }
  }

  console.log('\n🎉 SCHEMAS FULLY INITIALIZED ACROSS ALL 4 DATABASES!');
}

if (require.main === module) {
  initAllDatabases().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}

module.exports = { initAllDatabases };
