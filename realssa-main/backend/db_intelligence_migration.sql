-- 1. Parallel Market Exchange Rates
CREATE TABLE IF NOT EXISTS parallel_rates (
  id SERIAL PRIMARY KEY,
  currency VARCHAR(10) NOT NULL, -- "USD", "GBP", "EUR"
  buy_rate NUMERIC(10, 2) NOT NULL,
  sell_rate NUMERIC(10, 2) NOT NULL,
  source VARCHAR(100) DEFAULT 'Street Aggregator',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_rates_currency ON parallel_rates(currency, created_at DESC);

-- 2. Daily Market Commodity Prices
CREATE TABLE IF NOT EXISTS market_prices (
  id SERIAL PRIMARY KEY,
  item_name VARCHAR(100) NOT NULL, -- "Cement (Dangote)", "Fuel (NNPC)", "Tomato (Basket)"
  price NUMERIC(10, 2) NOT NULL,
  location VARCHAR(100) NOT NULL, -- "Lagos (Mile 12)", "Abuja", "Kano"
  unit VARCHAR(50) NOT NULL, -- "50kg bag", "Litre", "Big Basket"
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_prices_item ON market_prices(item_name, created_at DESC);

-- 3. Stock Exchange Tracker (NGX/NSE)
CREATE TABLE IF NOT EXISTS ngx_stocks (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL, -- "MTNN", "DANGSUGAR"
  company_name VARCHAR(255) NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  price_change NUMERIC(10, 2) NOT NULL,
  percent_change NUMERIC(5, 2) NOT NULL,
  volume BIGINT NOT NULL,
  trading_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_stocks_symbol_today ON ngx_stocks(symbol, trading_date);

-- 4. Nigerian Politician Database
CREATE TABLE IF NOT EXISTS politicians (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(100) NOT NULL, -- "Senator", "Representative", "Governor"
  state VARCHAR(50) NOT NULL,
  constituency VARCHAR(255),
  party VARCHAR(50) NOT NULL,
  profile_image VARCHAR(512),
  bio TEXT,
  assets_summary TEXT,
  voting_record JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Live Events Calendar
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL, -- "Concert", "Court Date", "Election", "Football Match"
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  location VARCHAR(255) NOT NULL,
  ticket_link VARCHAR(512),
  image_url VARCHAR(512),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);

-- 6. Event-to-Article Mapping Table
CREATE TABLE IF NOT EXISTS article_events (
  article_id INTEGER REFERENCES rss_articles(id) ON DELETE CASCADE,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, event_id)
);

-- 7. Knowledge Graph Entities
CREATE TABLE IF NOT EXISTS article_entities (
  id SERIAL PRIMARY KEY,
  article_id INTEGER REFERENCES rss_articles(id) ON DELETE CASCADE,
  entity_name VARCHAR(255) NOT NULL, -- Normalized canonical name (e.g. "Bola Tinubu")
  entity_type VARCHAR(50) NOT NULL, -- 'person', 'organization', 'location', 'sports_team'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_entities_name ON article_entities(entity_name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_article_entity ON article_entities(article_id, entity_name, entity_type);

-- 8. Alter articles table for metrics, translations and vector search
ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;
ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS reaction_count INTEGER DEFAULT 0;
ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS freshness_score DOUBLE PRECISION DEFAULT 0.0;
ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS title_translations JSONB DEFAULT '{}'::jsonb;
ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS summary_translations JSONB DEFAULT '{}'::jsonb;
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS embedding vector(768);
CREATE INDEX IF NOT EXISTS idx_freshness ON rss_articles(freshness_score DESC);
