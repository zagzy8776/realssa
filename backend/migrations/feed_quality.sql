-- Feed Quality Scoring System
-- Adds credibility scoring and article quality tracking

-- Add credibility score to sources
ALTER TABLE rss_articles
  ADD COLUMN IF NOT EXISTS source_credibility_score INTEGER DEFAULT 70;

-- Add quality metrics to articles
ALTER TABLE rss_articles
  ADD COLUMN IF NOT EXISTS word_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quality_score NUMERIC(5,2) DEFAULT 0;

-- Create index for quality scoring
CREATE INDEX IF NOT EXISTS idx_articles_quality
  ON rss_articles (quality_score DESC, published_at DESC);