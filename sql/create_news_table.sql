-- News table for tournament database
-- Stores all AI-generated and manual news items

CREATE TABLE IF NOT EXISTS news (
  id VARCHAR(255) PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  summary VARCHAR(500),
  category VARCHAR(50) NOT NULL, -- registration, team, auction, fantasy, match, announcement, milestone
  event_type VARCHAR(100) NOT NULL, -- player_milestone, team_registered, etc.
  season_id VARCHAR(50),
  season_name VARCHAR(100),
  is_published BOOLEAN DEFAULT false,
  generated_by VARCHAR(20) DEFAULT 'ai', -- 'ai' or 'admin'
  edited_by_admin BOOLEAN DEFAULT false,
  image_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  published_at TIMESTAMP
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_news_category ON news(category);
CREATE INDEX IF NOT EXISTS idx_news_season ON news(season_id);
CREATE INDEX IF NOT EXISTS idx_news_published ON news(is_published);
CREATE INDEX IF NOT EXISTS idx_news_created_at ON news(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_event_type ON news(event_type);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_news_published_created ON news(is_published, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_category_published ON news(category, is_published, created_at DESC);
