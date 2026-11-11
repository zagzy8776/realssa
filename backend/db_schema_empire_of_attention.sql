-- ======================================================
-- Empire of Attention Schema Extensions
-- Run this block ONCE in Neon SQL Editor
-- ======================================================

-- ── Velocity Tracking (views per second in rolling windows) ──
CREATE TABLE IF NOT EXISTS article_velocity (
  id SERIAL PRIMARY KEY,
  article_id INTEGER NOT NULL,
  category TEXT,
  views_1min INTEGER DEFAULT 0,
  views_5min INTEGER DEFAULT 0,
  views_15min INTEGER DEFAULT 0,
  views_60min INTEGER DEFAULT 0,
  velocity_1min DOUBLE PRECISION DEFAULT 0,   -- views per second in last 60s
  velocity_5min DOUBLE PRECISION DEFAULT 0,
  velocity_15min DOUBLE PRECISION DEFAULT 0,
  peak_velocity DOUBLE PRECISION DEFAULT 0,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (article_id, computed_at)
);

CREATE INDEX IF NOT EXISTS idx_article_velocity_article ON article_velocity(article_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_article_velocity_peak ON article_velocity(peak_velocity DESC);
CREATE INDEX IF NOT EXISTS idx_article_velocity_1min ON article_velocity(velocity_1min DESC);

-- ── Image Cache (re-hosted images from scraping) ──
CREATE TABLE IF NOT EXISTS image_cache (
  id SERIAL PRIMARY KEY,
  source_url TEXT NOT NULL,
  r2_url TEXT,
  r2_key TEXT,
  headline TEXT,
  ai_generated_headline TEXT,
  sentiment_score DOUBLE PRECISION,
  category TEXT,
  width INTEGER,
  height INTEGER,
  content_type TEXT,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (source_url)
);

CREATE INDEX IF NOT EXISTS idx_image_cache_category ON image_cache(category, cached_at DESC);
CREATE INDEX IF NOT EXISTS idx_image_cache_sentiment ON image_cache(sentiment_score DESC);

-- ── Behavior Patterns (subconscious suggestion engine data) ──
CREATE TABLE IF NOT EXISTS user_behavior_patterns (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL,
  session_id VARCHAR(255),
  scroll_speed_category TEXT, -- 'fast', 'medium', 'slow'
  dwell_time_avg DOUBLE PRECISION,
  hover_patterns JSONB,
  category_affinities JSONB,
  optimal_content_type TEXT, -- 'short_video', 'image_heavy', 'text_deep'
  optimal_ad_placement TEXT, -- 'pre_roll', 'mid_roll', 'banner'
  location_country TEXT,
  location_city TEXT,
  time_of_day_category TEXT, -- 'morning', 'afternoon', 'evening', 'night'
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_behavior_device ON user_behavior_patterns(device_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_behavior_optimal_type ON user_behavior_patterns(optimal_content_type);

-- ── Social Predictive Trending (from Twitter/X, Telegram, etc.) ──
CREATE TABLE IF NOT EXISTS social_trend_spikes (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL, -- 'twitter', 'telegram', 'reddit', 'tiktok'
  keyword TEXT NOT NULL,
  mention_count INTEGER DEFAULT 0,
  velocity DOUBLE PRECISION DEFAULT 0, -- mentions per minute
  predicted_trend_score DOUBLE PRECISION DEFAULT 0,
  related_articles JSONB,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (source, keyword, detected_at)
);

CREATE INDEX IF NOT EXISTS idx_social_trend_score ON social_trend_spikes(predicted_trend_score DESC, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_trend_keyword ON social_trend_spikes(keyword, detected_at DESC);

-- ── Crypto WebSocket Feed Cache ──
CREATE TABLE IF NOT EXISTS crypto_live_cache (
  id SERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  name TEXT,
  price DOUBLE PRECISION,
  change_24h DOUBLE PRECISION,
  volume_24h DOUBLE PRECISION,
  market_cap DOUBLE PRECISION,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (symbol)
);

-- ── Micro-Ad Targeting (subconscious suggestion engine) ──
CREATE TABLE IF NOT EXISTS micro_ad_targeting (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL,
  ad_id INTEGER,
  placement_type TEXT, -- 'pre_roll', 'mid_roll', 'banner', 'native', 'interstitial'
  category_context TEXT,
  behavior_trigger TEXT, -- 'fast_scroll', 'long_dwell', 'price_linger'
  ctr_score DOUBLE PRECISION DEFAULT 0,
  shown_at TIMESTAMPTZ DEFAULT NOW(),
  clicked BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_micro_ad_device ON micro_ad_targeting(device_id, shown_at DESC);
CREATE INDEX IF NOT EXISTS idx_micro_ad_placement ON micro_ad_targeting(placement_type, category_context);

-- ── Add velocity columns to existing rss_articles if not present ──
ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;
ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0;
ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS velocity_score DOUBLE PRECISION DEFAULT 0;
ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS predicted_trend_score DOUBLE PRECISION DEFAULT 0;
ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS image_r2_url TEXT;
ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS ai_headline TEXT;

-- =====================================================
-- Empire of Attention — Phase 2: Manufactured Attention Features
-- Run this block ONCE in Neon SQL Editor (appended to Phase 1)
-- =====================================================

-- ── Volatility Alarm Log (push triggers from price/social spikes) ──
CREATE TABLE IF NOT EXISTS volatility_alarms (
  id SERIAL PRIMARY KEY,
  trigger_source TEXT NOT NULL, -- 'crypto_price', 'social_panic', 'fear_greed'
  symbol TEXT,
  price DOUBLE PRECISION,
  prev_price DOUBLE PRECISION,
  pct_change DOUBLE PRECISION,
  social_velocity DOUBLE PRECISION,
  fear_greed_value INTEGER,
  severity TEXT DEFAULT 'watch', -- 'watch' | 'alert' | 'panic'
  push_sent BOOLEAN DEFAULT FALSE,
  affiliate_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_volatility_alarm_severity ON volatility_alarms(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_volatility_alarm_symbol ON volatility_alarms(symbol, created_at DESC);

-- ── Live Viewer Counts (synthetic social proof) ──
-- Real counts come from the telemetry beacon; synthetic baseline is
-- seeded from category affinity + time-of-day curves so the number
-- always looks alive even when the room is quiet.
CREATE TABLE IF NOT EXISTS live_viewer_counts (
  id SERIAL PRIMARY KEY,
  scope_type TEXT NOT NULL, -- 'article' | 'category' | 'global'
  scope_id TEXT NOT NULL,
  real_count INTEGER DEFAULT 0,
  synthetic_boost INTEGER DEFAULT 0,
  display_count INTEGER DEFAULT 0,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (scope_type, scope_id)
);

CREATE INDEX IF NOT EXISTS idx_live_viewer_computed ON live_viewer_counts(computed_at DESC);

-- ── Live Reactions persistence (extends article_reactions) ──
-- The existing article_reactions table uses fire/heart/wow. LiveReacts.tsx
-- uses fire/angry/sad/clap/shock. We normalize them here.
ALTER TABLE article_reactions ADD COLUMN IF NOT EXISTS emoji TEXT;
ALTER TABLE article_reactions ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'native';

-- Normalize legacy rows
UPDATE article_reactions SET emoji = reaction_type, source = 'native' WHERE emoji IS NULL;

-- =====================================================
-- End of Empire of Attention Schema — Phase 2
-- =====================================================
-- ======================================================
-- End of Empire of Attention Schema
-- ======================================================