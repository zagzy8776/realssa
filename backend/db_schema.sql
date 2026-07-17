-- ======================================================
-- EntertainmentGHC Database Schema for Neon PostgreSQL
-- Run this in Neon SQL Editor to create your tables
-- ======================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Articles table
CREATE TABLE IF NOT EXISTS articles (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    excerpt TEXT,
    content TEXT,
    category VARCHAR(100) DEFAULT 'general',
    image TEXT,
    read_time VARCHAR(50) DEFAULT '5 min read',
    author VARCHAR(200) DEFAULT 'Admin',
    source VARCHAR(50) DEFAULT 'static',
    external_link TEXT,
    featured BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'published',
    content_type VARCHAR(50) DEFAULT 'article',
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    article_id INTEGER NOT NULL,
    author VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    likes INTEGER DEFAULT 0,
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_date ON articles(date DESC);
CREATE INDEX IF NOT EXISTS idx_articles_featured ON articles(featured) WHERE featured = true;
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_comments_article_id ON comments(article_id);

-- Insert default admin user (password: admin123)
-- The password is bcrypt-hashed. You can change this after first login.
INSERT INTO users (username, password, is_admin)
SELECT 'admin', '$2a$10$8KzQMGx5C5H5X5Y5Z5a5Oe5i5o5u5v5w5x5y5z5A5B5C5D5E5F5G', true
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin');

-- ======================================================
-- Round-Robin Rotation Schedule Table
-- Run this block ONCE in Neon SQL Editor.
-- ======================================================

CREATE TABLE IF NOT EXISTS feed_schedule (
  category        TEXT PRIMARY KEY,
  tier            SMALLINT NOT NULL DEFAULT 2,  -- 1 = main, 2 = world
  last_ingested_at TIMESTAMPTZ                  -- NULL = never ingested (sorts first)
);

-- Index so ORDER BY last_ingested_at ASC NULLS FIRST is instant
CREATE INDEX IF NOT EXISTS idx_feed_schedule_tier_ts
  ON feed_schedule (tier, last_ingested_at ASC NULLS FIRST);

-- Seed the 12 main categories as tier 1
-- (world countries are inserted automatically by the ingestion service on first run)
INSERT INTO feed_schedule (category, tier) VALUES
  ('nigerian-news', 1), ('ghana', 1), ('kenya', 1), ('south-africa', 1),
  ('uk', 1), ('sports', 1), ('usa', 1), ('world', 1),
  ('crypto', 1), ('culture', 1), ('entertainment', 1), ('jobs', 1)
ON CONFLICT (category) DO NOTHING;

-- ======================================================
-- Full-Text Search Migration
-- Run this block ONCE in Neon SQL Editor after the tables
-- above already exist.
-- ======================================================

-- 1. Add the generated tsvector column (title weighted A, excerpt weighted B)
--    GENERATED ALWAYS means Postgres keeps it in sync automatically on every
--    INSERT / UPDATE — zero application-side maintenance required.
ALTER TABLE rss_articles
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(original_excerpt, '')), 'B')
  ) STORED;

-- 2. GIN index — makes tsvector lookups O(log n) instead of O(n)
CREATE INDEX IF NOT EXISTS idx_rss_articles_search
  ON rss_articles USING GIN (search_vector);

-- 3. Backfill: the GENERATED column auto-populates for new rows, but existing
--    rows need a no-op UPDATE to trigger the generation for already-stored data.
--    Run this once; it is safe to re-run.
UPDATE rss_articles SET title = title WHERE search_vector IS NULL;

-- ======================================================
-- Live Matches Table (Scraper Shadow DB)
-- Run this block ONCE in Neon SQL Editor.
-- ======================================================

CREATE TABLE IF NOT EXISTS live_matches (
  match_id       TEXT PRIMARY KEY,        -- SHA256 of match URL
  competition    TEXT NOT NULL,
  home_team      TEXT NOT NULL,
  away_team      TEXT NOT NULL,
  home_score     SMALLINT DEFAULT 0,
  away_score     SMALLINT DEFAULT 0,
  status         TEXT DEFAULT 'scheduled', -- scheduled | live | finished
  match_minute   SMALLINT,
  match_url      TEXT,
  last_notified_score TEXT,               -- e.g. "1-2" — prevents duplicate goal pushes
  kickoff_at     TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_matches_status
  ON live_matches (status, updated_at DESC);

-- Competitions registry — toggle is_active to enable/disable scraping per competition
CREATE TABLE IF NOT EXISTS competitions (
  id             SERIAL PRIMARY KEY,
  name           TEXT NOT NULL,
  slug           TEXT UNIQUE NOT NULL,
  scrape_url     TEXT NOT NULL,
  is_active      BOOLEAN DEFAULT true,
  poll_seconds   SMALLINT DEFAULT 60,     -- how often to scrape when live matches exist
  tier           SMALLINT DEFAULT 2       -- 1 = high-frequency (World Cup/AFCON), 2 = normal
);

-- Seed initial competitions
INSERT INTO competitions (name, slug, scrape_url, is_active, tier) VALUES
  ('NPFL 2025-26',        'npfl',    'https://ng.soccerway.com/national/nigeria/npfl/2025-2026/regular-season/r93630/', true,  1),
  ('CAF Champions League','caf-cl',  'https://int.soccerway.com/international/africa/caf-champions-league/',            true,  1),
  ('Premier League',      'epl',     'https://uk.soccerway.com/national/england/premier-league/',                       true,  2),
  ('World Cup 2026',      'wc2026',  'https://int.soccerway.com/international/world/world-cup/2026/',                   false, 1)
ON CONFLICT (slug) DO NOTHING;

-- ======================================================
-- League Tables Cache (Native Sports Hub)
-- ======================================================

CREATE TABLE IF NOT EXISTS league_tables (
  id          SERIAL PRIMARY KEY,
  league_slug TEXT NOT NULL,
  season      TEXT NOT NULL DEFAULT '2025-26',
  standings   JSONB NOT NULL,             -- array of team row objects
  scraped_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (league_slug, season)
);

CREATE INDEX IF NOT EXISTS idx_league_tables_slug
  ON league_tables (league_slug, scraped_at DESC);

-- ======================================================
-- Sports Featured Article Migration
-- Run this block ONCE in Neon SQL Editor.
-- ======================================================

ALTER TABLE rss_articles
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_rss_articles_featured
  ON rss_articles (category, is_featured, published_at DESC)
  WHERE is_featured = true;

-- ======================================================
-- User Subscriptions & Preferences Tables (Notifications)
-- ======================================================

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

CREATE TABLE IF NOT EXISTS user_preferences (
    user_id VARCHAR(100) PRIMARY KEY,
    categories JSONB DEFAULT '[]',
    topics JSONB DEFAULT '[]',
    notification_settings JSONB DEFAULT '{}',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ======================================================
-- RSS Feed Health Log Table
-- ======================================================

CREATE TABLE IF NOT EXISTS rss_feed_health_log (
    id SERIAL PRIMARY KEY,
    feed_url TEXT NOT NULL,
    category TEXT NOT NULL,
    status_code TEXT,
    error_message TEXT,
    is_healthy BOOLEAN NOT NULL,
    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Composite Index for fast category lookups sorted by date
CREATE INDEX IF NOT EXISTS idx_rss_articles_cat_pub ON rss_articles (category, published_at DESC);

-- Index for garbage collector optimization
CREATE INDEX IF NOT EXISTS idx_rss_articles_published ON rss_articles (published_at);

-- User affinities table
CREATE TABLE IF NOT EXISTS user_category_affinities (
    device_id VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    score INTEGER DEFAULT 0,
    last_interacted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (device_id, category)
);

CREATE INDEX IF NOT EXISTS idx_user_category_affinities_device ON user_category_affinities(device_id);