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
