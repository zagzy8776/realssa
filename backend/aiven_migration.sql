-- RealSSA primary PostgreSQL post-schema migrations.
-- Run after rss_articles_schema.sql and db_schema.sql.
-- Safe to run repeatedly with IF NOT EXISTS guards.

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
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rss_articles_story_hash_key'
  ) THEN
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

-- Storage guard: keep only a rolling working set of news.
-- RSS remains the long-tail source; PostgreSQL does not need to retain every
-- historical article forever. This prevents the news table from growing
-- without bound while preserving recent stories for the application.
CREATE OR REPLACE FUNCTION realssa_cleanup_news() RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM rss_articles
  WHERE published_at < NOW() - INTERVAL '7 days';

  DELETE FROM rss_articles
  WHERE id NOT IN (
    SELECT id
    FROM rss_articles
    ORDER BY published_at DESC NULLS LAST, id DESC
    LIMIT 20000
  );

  -- Large enrichment fields are unnecessary on older live stories.
  UPDATE rss_articles
  SET full_content = NULL,
      title_translations = NULL,
      summary_translations = NULL,
      embedding = NULL
  WHERE published_at < NOW() - INTERVAL '2 days'
    AND (full_content IS NOT NULL OR title_translations IS NOT NULL
      OR summary_translations IS NOT NULL OR embedding IS NOT NULL);

  ANALYZE rss_articles;
END;
$$;

-- If pg_cron has been installed on this database, automatically run the
-- storage guard every 15 minutes. On Aiven, pg_cron is supported; if it is
-- not installed yet, the application-side retention guard remains available.
DO $$
DECLARE
  existing_job BIGINT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    SELECT jobid INTO existing_job
    FROM cron.job
    WHERE jobname = 'realssa-news-retention'
    LIMIT 1;

    IF existing_job IS NOT NULL THEN
      PERFORM cron.unschedule(existing_job);
    END IF;

    PERFORM cron.schedule(
      'realssa-news-retention',
      '*/15 * * * *',
      'SELECT realssa_cleanup_news();'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'RealSSA pg_cron retention schedule not installed: %', SQLERRM;
END $$;

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

CREATE INDEX IF NOT EXISTS idx_cinema_sources_media
  ON cinema_sources (tmdb_id, media_type, season, episode);
