-- ======================================================
-- Video Streaming Platform Database Schema
-- Run these table definitions on Neon Postgres
-- ======================================================

-- 1. Movies Table (DB6 / Neon DB 1)
CREATE TABLE IF NOT EXISTS movies (
    id INTEGER PRIMARY KEY, -- Using TMDB ID as primary key
    title TEXT NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    backdrop_url TEXT,
    release_year INTEGER,
    duration_minutes INTEGER,
    rating NUMERIC(3,1),
    genres TEXT[], -- String array for genres
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movies_rating ON movies(rating DESC);
CREATE INDEX IF NOT EXISTS idx_movies_year ON movies(release_year DESC);

-- 2. TV Shows Table (DB7 / Neon DB 2)
CREATE TABLE IF NOT EXISTS tv_shows (
    id INTEGER PRIMARY KEY, -- Using TMDB ID as primary key
    title TEXT NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    backdrop_url TEXT,
    release_year INTEGER,
    rating NUMERIC(3,1),
    genres TEXT[],
    seasons_count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Episodes Table (DB7 / Neon DB 2)
CREATE TABLE IF NOT EXISTS episodes (
    id SERIAL PRIMARY KEY,
    show_id INTEGER NOT NULL REFERENCES tv_shows(id) ON DELETE CASCADE,
    season_number INTEGER NOT NULL,
    episode_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    air_date TEXT,
    duration_minutes INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(show_id, season_number, episode_number)
);

CREATE INDEX IF NOT EXISTS idx_episodes_lookup ON episodes(show_id, season_number, episode_number);

-- 3. Video Sources Table (DB8 / Neon DB 3)
CREATE TABLE IF NOT EXISTS video_sources (
    id SERIAL PRIMARY KEY,
    media_type VARCHAR(20) NOT NULL, -- 'movie' or 'episode'
    media_id INTEGER NOT NULL, -- TMDB ID for movie, or episode's id
    source_name VARCHAR(100) NOT NULL, -- 'Server 1', 'VidSrc', etc.
    url TEXT NOT NULL, -- Embed URL or stream URL
    quality VARCHAR(20) DEFAULT '1080p',
    is_embed BOOLEAN DEFAULT true,
    last_verified_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(media_type, media_id, source_name)
);

CREATE INDEX IF NOT EXISTS idx_video_sources_lookup ON video_sources(media_type, media_id);
