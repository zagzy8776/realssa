/**
 * Idempotent schema bootstrap for the RSS persistence layer.
 * Safe to call on every Vercel/Fly cron invocation — CREATE IF NOT EXISTS only.
 */
const readyPools = new WeakSet();
const inFlight = new WeakMap();

const BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS rss_articles (
    id SERIAL PRIMARY KEY,
    url_hash VARCHAR(64) UNIQUE NOT NULL,
    story_hash VARCHAR(64),
    title TEXT NOT NULL,
    original_excerpt TEXT,
    ai_summary TEXT,
    category VARCHAR(100),
    image TEXT,
    image_status VARCHAR(16) NOT NULL DEFAULT 'pending',
    image_checked_at TIMESTAMPTZ,
    image_width INTEGER,
    image_height INTEGER,
    author VARCHAR(200),
    source_name VARCHAR(200),
    external_link TEXT,
    published_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    content_type VARCHAR(50) DEFAULT 'article',
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    view_count INTEGER DEFAULT 0,
    full_content TEXT,
    title_translations JSONB,
    summary_translations JSONB,
    embedding TEXT,
    local_verified_count INT DEFAULT 0,
    rumor_flag_count INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_rss_articles_url_hash ON rss_articles(url_hash);
CREATE INDEX IF NOT EXISTS idx_rss_articles_category ON rss_articles(category);
CREATE INDEX IF NOT EXISTS idx_rss_articles_published ON rss_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_rss_articles_content_type ON rss_articles(content_type);
CREATE INDEX IF NOT EXISTS idx_rss_articles_needs_summary
  ON rss_articles(id) WHERE ai_summary IS NULL AND content_type = 'article';
CREATE INDEX IF NOT EXISTS idx_rss_articles_featured
  ON rss_articles(category, is_featured, published_at DESC) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_rss_articles_story_hash ON rss_articles(story_hash);
CREATE INDEX IF NOT EXISTS idx_rss_articles_views ON rss_articles(view_count DESC);

ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS story_hash VARCHAR(64);
ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS image_status VARCHAR(16) DEFAULT 'pending';
ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS image_checked_at TIMESTAMPTZ;
ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS image_width INTEGER;
ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS image_height INTEGER;
ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;
ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS full_content TEXT;
ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS title_translations JSONB;
ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS summary_translations JSONB;
ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS embedding TEXT;
ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS local_verified_count INT DEFAULT 0;
ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS rumor_flag_count INT DEFAULT 0;

CREATE TABLE IF NOT EXISTS notified_articles (
    id BIGSERIAL PRIMARY KEY,
    story_hash TEXT UNIQUE,
    notified_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notified_articles_notified_at
  ON notified_articles(notified_at DESC);
`;

async function ensureRssSchema(pool) {
  if (!pool) throw new Error('Database pool is required to ensure rss_articles schema');
  if (readyPools.has(pool)) return { ok: true, cached: true };

  const existing = inFlight.get(pool);
  if (existing) return existing;

  const promise = (async () => {
    try {
      await pool.query(BOOTSTRAP_SQL);
      readyPools.add(pool);
      return { ok: true, cached: false };
    } catch (error) {
      inFlight.delete(pool);
      console.error('[ensureRssSchema] Bootstrap failed:', error.message);
      throw new Error(`rss_articles schema bootstrap failed: ${error.message}`);
    } finally {
      // keep inFlight only while running; after success WeakSet caches readiness
    }
  })();

  inFlight.set(pool, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(pool);
  }
}

module.exports = { ensureRssSchema };
