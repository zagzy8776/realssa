CREATE TABLE IF NOT EXISTS feed_quality_scores (
  article_id INTEGER PRIMARY KEY REFERENCES rss_articles(id) ON DELETE CASCADE,
  word_count INTEGER DEFAULT 0,
  image_count INTEGER DEFAULT 0,
  video_count INTEGER DEFAULT 0,
  quality_score NUMERIC(5,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feed_quality_scores ON feed_quality_scores (quality_score DESC, updated_at DESC);