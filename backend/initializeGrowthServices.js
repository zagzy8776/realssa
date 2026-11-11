// Initialize growth services with enhanced distribution
const { Pool } = require('pg');

async function initializeGrowthServices() {
  console.log('🚀 Initializing Growth Services...');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Ensure growth tables exist
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

    // Insert initial feeds from world_feeds.json if not exist
    try {
      const fs = require('fs');
      const worldFeedsData = JSON.parse(fs.readFileSync('../data/world_feeds.json', 'utf8'));
      const seeds = Object.entries(worldFeedsData).flatMap(([country,data]) =>
        (data.urls || (data.url ? [data.url] : [])).map(url => ({url,country,language:data.language || null})));
      await pool.query(
        "INSERT INTO growth_feeds(url,country,language,origin) SELECT url,country,language,'registry' FROM jsonb_to_recordset($1::jsonb) AS x(url text,country text,language text) ON CONFLICT DO NOTHING",
        [JSON.stringify(seeds)]
      );
      console.log('✅ Initial feeds seeded.');
    } catch (err) {
      console.error('Failed to seed initial feeds:', err.message);
    }

    // Initialize quality scoring for existing articles
    try {
      const { analyzeArticleQuality } = require('./services/feedQuality');
      const { rows } = await pool.query('SELECT id FROM rss_articles WHERE id NOT IN (SELECT article_id FROM feed_quality_scores)');
      if (rows.length > 0) {
        console.log(`Scoring ${rows.length} articles for quality metrics...`);
        for (const article of rows) {
          try {
            const qualityMetrics = await analyzeArticleQuality(article);
            await pool.query(
              `INSERT INTO feed_quality_scores (article_id, word_count, image_count, video_count, quality_score)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (article_id) DO UPDATE SET
               word_count = EXCLUDED.word_count,
               image_count = EXCLUDED.image_count,
               video_count = EXCLUDED.video_count,
               quality_score = EXCLUDED.quality_score`,
              [article.id, qualityMetrics.word_count, qualityMetrics.image_count, qualityMetrics.video_count, qualityMetrics.quality_score]
            );
          } catch (err) {
            console.error(`Failed to score article ${article.id}:`, err.message);
          }
        }
        console.log('✅ Quality scoring complete.');
      } else {
        console.log('✅ All articles already quality-scored.');
      }
    } catch (err) {
      console.error('Failed to run quality scoring:', err.message);
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

module.exports = { initializeGrowthServices };