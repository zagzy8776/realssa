-- ============================================================================
-- Tasks 7, 8, 9, 11 — Sports ingestion refactor + click sessions
-- Idempotent: safe to run multiple times against the same database.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Task 9: Fixture coverage table (fixture-driven coverage, not source-driven)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fixtures (
  id                SERIAL PRIMARY KEY,
  fixture_id        TEXT UNIQUE NOT NULL,
  competition_name  TEXT,
  home_team         TEXT,
  away_team         TEXT,
  kickoff_at        TIMESTAMPTZ,
  status            TEXT DEFAULT 'scheduled',
  has_valid_source  BOOLEAN DEFAULT false,
  last_source_probe TIMESTAMPTZ,
  expiry_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fixtures_kickoff ON fixtures (kickoff_at);
CREATE INDEX IF NOT EXISTS idx_fixtures_status  ON fixtures (status);
CREATE INDEX IF NOT EXISTS idx_fixtures_probe   ON fixtures (has_valid_source, kickoff_at);

-- ---------------------------------------------------------------------------
-- Task 7: extend the existing live_streams table with scoring metadata.
-- NOTE: live_streams is created in server.js with columns:
--   id, match_id, match_title, home_team, away_team, stream_url, stream_type,
--   quality, language, is_live, is_verified, url_hash UNIQUE, created_at, updated_at
-- ---------------------------------------------------------------------------
-- Create the base table first so the ALTERs below are never a no-op when the
-- migration runs before server.js has booted (server.js also creates it).
CREATE TABLE IF NOT EXISTS live_streams (
  id          SERIAL PRIMARY KEY,
  match_id    TEXT,
  match_title TEXT,
  home_team   TEXT,
  away_team   TEXT,
  stream_url  TEXT NOT NULL,
  stream_type TEXT,
  quality     TEXT,
  language    TEXT,
  is_live     BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  url_hash    TEXT UNIQUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS live_streams ADD COLUMN IF NOT EXISTS referer    TEXT;
ALTER TABLE IF EXISTS live_streams ADD COLUMN IF NOT EXISTS resolution TEXT;
ALTER TABLE IF EXISTS live_streams ADD COLUMN IF NOT EXISTS bitrate    INTEGER;
ALTER TABLE IF EXISTS live_streams ADD COLUMN IF NOT EXISTS score      DOUBLE PRECISION DEFAULT 0;
ALTER TABLE IF EXISTS live_streams ADD COLUMN IF NOT EXISTS status     TEXT DEFAULT 'active';
ALTER TABLE IF EXISTS live_streams ADD COLUMN IF NOT EXISTS fixture_id TEXT;

CREATE INDEX IF NOT EXISTS idx_live_streams_fixture ON live_streams (fixture_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_live_streams_live    ON live_streams (is_live, score DESC);

-- Guarantee the ON CONFLICT (url_hash) upsert used by discoverAndValidateStreams works.
CREATE UNIQUE INDEX IF NOT EXISTS idx_live_streams_url_hash ON live_streams (url_hash);

-- ---------------------------------------------------------------------------
-- Task 11: click session telemetry
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS click_sessions (
  id                SERIAL PRIMARY KEY,
  session_id        TEXT UNIQUE NOT NULL,
  proxy_server      TEXT,
  geo               TEXT,
  query             TEXT,
  target_domain     TEXT,
  landed_url        TEXT,
  dwell_time_ms     INTEGER,
  scroll_steps      INTEGER,
  outcome           TEXT,
  start_time        TIMESTAMPTZ,
  end_time          TIMESTAMPTZ,
  total_duration_ms INTEGER,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_click_sessions_outcome ON click_sessions (outcome);
CREATE INDEX IF NOT EXISTS idx_click_sessions_geo     ON click_sessions (geo);
CREATE INDEX IF NOT EXISTS idx_click_sessions_start   ON click_sessions (start_time);

-- ---------------------------------------------------------------------------
-- Task 7/8: per-stream health history (feeds the uptime component of scoring)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stream_health_checks (
  id               SERIAL PRIMARY KEY,
  stream_url       TEXT NOT NULL,
  status_code      INTEGER,
  response_time_ms INTEGER,
  is_valid         BOOLEAN,
  error_message    TEXT,
  checked_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stream_health_url     ON stream_health_checks (stream_url);
CREATE INDEX IF NOT EXISTS idx_stream_health_checked ON stream_health_checks (checked_at);

-- ---------------------------------------------------------------------------
-- Helper view: 7-day uptime ratio per stream URL (used by scoreStream)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW stream_uptime_7d AS
SELECT
  stream_url,
  COUNT(*)                                     AS checks,
  AVG(CASE WHEN is_valid THEN 1.0 ELSE 0.0 END) AS uptime_ratio,
  AVG(response_time_ms)                         AS avg_latency_ms
FROM stream_health_checks
WHERE checked_at > NOW() - INTERVAL '7 days'
GROUP BY stream_url;

-- Retention helper (call from cron / scheduled job)
CREATE OR REPLACE FUNCTION cleanup_stream_health()
RETURNS VOID AS $$
BEGIN
  DELETE FROM stream_health_checks WHERE checked_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Indexing / SEO support tables
-- These are also created inline by their owning services
-- (googleIndexing.js, keywordRadar.js, countryIntel.js). Defining them here
-- makes a fresh database fully provisioned from migrations alone.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Permanent Google Indexing API failures (googleIndexing.js)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS indexing_dead_letter (
  id              SERIAL PRIMARY KEY,
  url             TEXT NOT NULL,
  article_id      TEXT,
  status_code     INTEGER,
  error_message   TEXT,
  attempt_count   INTEGER DEFAULT 0,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_attempt_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_indexing_dead_letter_url        ON indexing_dead_letter (url);
CREATE INDEX IF NOT EXISTS idx_indexing_dead_letter_created_at ON indexing_dead_letter (created_at);

-- ---------------------------------------------------------------------------
-- Rising search queries detected by the keyword radar (keywordRadar.js)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rising_queries (
  id            SERIAL PRIMARY KEY,
  query         TEXT NOT NULL,
  geo           TEXT NOT NULL,
  volume_1h     INTEGER DEFAULT 0,
  baseline_7d   INTEGER DEFAULT 100,
  score         DOUBLE PRECISION DEFAULT 0,
  first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  published_url TEXT,
  status        TEXT DEFAULT 'active',
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (query, geo)
);

CREATE INDEX IF NOT EXISTS idx_rising_queries_score  ON rising_queries (score DESC);
CREATE INDEX IF NOT EXISTS idx_rising_queries_geo    ON rising_queries (geo);
CREATE INDEX IF NOT EXISTS idx_rising_queries_status ON rising_queries (status);

-- ---------------------------------------------------------------------------
-- Thin-content country pages flagged noindex (countryIntel.js)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS thin_pages (
  id              SERIAL PRIMARY KEY,
  country_slug    TEXT NOT NULL,
  country_name    TEXT NOT NULL,
  headline_count  INTEGER DEFAULT 0,
  last_checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  noindex_reason  TEXT,
  UNIQUE (country_slug)
);

CREATE INDEX IF NOT EXISTS idx_thin_pages_slug ON thin_pages (country_slug);
