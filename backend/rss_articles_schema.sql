-- ======================================================
-- RSS Articles Table Schema for PostgreSQL
-- This table stores all RSS-ingested articles with AI summaries.
-- The same schema works on Aiven PostgreSQL and other standard PostgreSQL servers.
-- ======================================================

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
    published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    content_type VARCHAR(50) DEFAULT 'article',
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rss_articles_url_hash ON rss_articles(url_hash);
CREATE INDEX IF NOT EXISTS idx_rss_articles_category ON rss_articles(category);
CREATE INDEX IF NOT EXISTS idx_rss_articles_published ON rss_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_rss_articles_content_type ON rss_articles(content_type);
CREATE INDEX IF NOT EXISTS idx_rss_articles_needs_summary ON rss_articles(id) WHERE ai_summary IS NULL AND content_type = 'article';
CREATE INDEX IF NOT EXISTS idx_rss_articles_featured ON rss_articles(category, is_featured, published_at DESC) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_rss_articles_story_hash ON rss_articles(story_hash);

ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_rss_articles_views ON rss_articles(view_count DESC);
