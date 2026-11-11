-- Feed Scale-Out migration
-- Adds per-URL quality metrics and discovery tracking.
-- Safe to run multiple times (all IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

ALTER TABLE feed_health
  ADD COLUMN IF NOT EXISTS articles_24h INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS articles_7d INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_latency_ms INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS success_rate NUMERIC(5,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quality_score NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_articles_at TIMESTAMPTZ;

ALTER TABLE feed_schedule
  ADD COLUMN IF NOT EXISTS weight NUMERIC(6,4) DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS discovered_via TEXT;

CREATE TABLE IF NOT EXISTS feed_discoveries (
  url TEXT PRIMARY KEY,
  country TEXT NOT NULL,
  source_url TEXT,
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  validated BOOLEAN DEFAULT false,
  validated_at TIMESTAMPTZ,
  rejection_reason TEXT,
  attempts INTEGER DEFAULT 0,
  next_attempt_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feed_discoveries_pending
  ON feed_discoveries (next_attempt_at)
  WHERE validated IS false;