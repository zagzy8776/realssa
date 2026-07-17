-- ======================================================
-- RSS Articles Table Schema for Neon PostgreSQL
-- This table stores all RSS-ingested articles with AI summaries
-- Run this in your Neon SQL Editor if the table doesn't exist
-- ======================================================

-- RSS Articles table (for automated content from feeds)
CREATE TABLE IF NOT EXISTS rss_articles (
    id SERIAL PRIMARY KEY,
    url_hash VARCHAR(64) UNIQUE NOT NULL,
    title TEXT NOT NULL,
    original_excerpt TEXT,
    ai_summary TEXT,
    category VARCHAR(100),
    image TEXT,
    author VARCHAR(200),
    source_name VARCHAR(200),
    external_link TEXT,
    published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    content_type VARCHAR(50) DEFAULT 'article',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rss_articles_url_hash ON rss_articles(url_hash);
CREATE INDEX IF NOT EXISTS idx_rss_articles_category ON rss_articles(category);
CREATE INDEX IF NOT EXISTS idx_rss_articles_published ON rss_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_rss_articles_content_type ON rss_articles(content_type);
CREATE INDEX IF NOT EXISTS idx_rss_articles_needs_summary ON rss_articles(id) WHERE ai_summary IS NULL AND content_type = 'article';

-- Comments: This table is optimized for:
-- 1. Fast duplicate detection via url_hash
-- 2. Quick category filtering
-- 3. Efficient date-based queries
-- 4. Finding articles that need AI summaries

-- ── View Counter (run this if upgrading existing DB) ──────────────────────
ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_rss_articles_views ON rss_articles(view_count DESC);
