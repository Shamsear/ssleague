-- ============================================
-- CREATE POLLS SYSTEM TABLES
-- ============================================

-- Polls table
CREATE TABLE IF NOT EXISTS polls (
  id SERIAL PRIMARY KEY,
  poll_id VARCHAR(100) UNIQUE NOT NULL,
  news_id VARCHAR(255), -- Linked news article
  season_id VARCHAR(100) NOT NULL,
  
  -- Poll type
  poll_type VARCHAR(50) NOT NULL,
  -- 'match_prediction', 'player_of_match', 
  -- 'daily_player', 'daily_team',
  -- 'weekly_player', 'weekly_team', 'weekly_manager',
  -- 'season_golden_boot', 'season_champion', etc.
  
  -- Bilingual titles
  title_en TEXT NOT NULL,
  title_ml TEXT,
  description_en TEXT,
  description_ml TEXT,
  
  -- Related entities
  related_fixture_id VARCHAR(255),
  related_round_id VARCHAR(255),
  related_matchday_date DATE,
  
  -- Poll options (JSON)
  options JSONB NOT NULL,
  -- Example: [
  --   {"id": "opt1", "text_en": "Red Lions Win", "text_ml": "റെഡ് ലയൺസ് ജയിക്കും", "team_id": "team1", "votes": 0},
  --   {"id": "opt2", "text_en": "Messi", "text_ml": "മെസ്സി", "player_id": "p123", "votes": 0}
  -- ]
  
  -- Status
  status VARCHAR(20) DEFAULT 'active', -- active, closed
  
  -- Timing
  opens_at TIMESTAMP DEFAULT NOW(),
  closes_at TIMESTAMP NOT NULL,
  result_announced_at TIMESTAMP,
  
  -- Results
  winning_option_id VARCHAR(50), -- Actual winner
  total_votes INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(100), -- admin user ID
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Poll votes
CREATE TABLE IF NOT EXISTS poll_votes (
  id SERIAL PRIMARY KEY,
  vote_id VARCHAR(100) UNIQUE NOT NULL,
  poll_id VARCHAR(100) NOT NULL REFERENCES polls(poll_id) ON DELETE CASCADE,
  
  user_id VARCHAR(100) NOT NULL,
  user_name VARCHAR(255),
  user_team_id VARCHAR(100),
  
  selected_option_id VARCHAR(50) NOT NULL,
  is_correct BOOLEAN DEFAULT NULL, -- Set after poll closes
  
  voted_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(poll_id, user_id)
);

-- Poll results (cached for performance)
CREATE TABLE IF NOT EXISTS poll_results (
  id SERIAL PRIMARY KEY,
  poll_id VARCHAR(100) NOT NULL REFERENCES polls(poll_id) ON DELETE CASCADE,
  option_id VARCHAR(50) NOT NULL,
  option_text_en TEXT NOT NULL,
  option_text_ml TEXT,
  vote_count INTEGER DEFAULT 0,
  vote_percentage DECIMAL(5,2) DEFAULT 0,
  is_winner BOOLEAN DEFAULT FALSE,
  
  last_updated TIMESTAMP DEFAULT NOW(),
  UNIQUE(poll_id, option_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_polls_season ON polls(season_id);
CREATE INDEX IF NOT EXISTS idx_polls_type ON polls(poll_type);
CREATE INDEX IF NOT EXISTS idx_polls_fixture ON polls(related_fixture_id);
CREATE INDEX IF NOT EXISTS idx_polls_round ON polls(related_round_id);
CREATE INDEX IF NOT EXISTS idx_polls_status ON polls(status);
CREATE INDEX IF NOT EXISTS idx_polls_closes_at ON polls(closes_at);

CREATE INDEX IF NOT EXISTS idx_poll_votes_user ON poll_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll ON poll_votes(poll_id);

CREATE INDEX IF NOT EXISTS idx_poll_results_poll ON poll_results(poll_id);

-- ============================================
-- UPDATE NEWS TABLE FOR BILINGUAL SUPPORT
-- ============================================

-- Add new columns to news table
ALTER TABLE news 
  ADD COLUMN IF NOT EXISTS language VARCHAR(5) DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS tone VARCHAR(20) DEFAULT 'neutral',
  ADD COLUMN IF NOT EXISTS reporter_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS has_poll BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS poll_id VARCHAR(100);

-- Create index on language for filtering
CREATE INDEX IF NOT EXISTS idx_news_language ON news(language);
CREATE INDEX IF NOT EXISTS idx_news_season_language ON news(season_id, language);
CREATE INDEX IF NOT EXISTS idx_news_poll ON news(poll_id);

-- Add foreign key for poll_id
ALTER TABLE news
  ADD CONSTRAINT fk_news_poll 
  FOREIGN KEY (poll_id) REFERENCES polls(poll_id) ON DELETE SET NULL;

-- ============================================
-- ADD COMMENTS
-- ============================================
COMMENT ON TABLE polls IS 'Community polls for matches, players, and season predictions';
COMMENT ON TABLE poll_votes IS 'Individual user votes on polls';
COMMENT ON TABLE poll_results IS 'Cached poll results for performance';

COMMENT ON COLUMN news.language IS 'Language: en (English) or ml (Malayalam)';
COMMENT ON COLUMN news.tone IS 'Tone: neutral, funny, harsh, or dramatic';
COMMENT ON COLUMN news.reporter_name IS 'Reporter name (Alex Thompson or രാജേഷ് നായർ)';

-- ============================================
-- VERIFICATION
-- ============================================
SELECT 'polls' as table_name, COUNT(*) as row_count FROM polls
UNION ALL
SELECT 'poll_votes', COUNT(*) FROM poll_votes
UNION ALL
SELECT 'poll_results', COUNT(*) FROM poll_results;

SELECT '✅ Polls system tables created successfully!' as status;
