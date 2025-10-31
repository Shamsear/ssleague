-- ============================================
-- CREATE PLAYER_AWARDS TABLE
-- Tracks individual and category awards for players
-- Separate from realplayerstats for better querying
-- ============================================

CREATE TABLE IF NOT EXISTS player_awards (
  id SERIAL PRIMARY KEY,
  
  -- Player Information
  player_id VARCHAR(255) NOT NULL,
  player_name VARCHAR(255) NOT NULL,
  
  -- Season Context
  season_id VARCHAR(255) NOT NULL,
  
  -- Award Details
  award_category VARCHAR(50) NOT NULL,  -- 'individual' or 'category'
  award_type VARCHAR(100) NOT NULL,     -- 'Golden Boot', 'Best Attacker', 'Player of Season', etc.
  award_position VARCHAR(50),           -- 'Winner', 'Runner Up', NULL for single winner awards
  
  -- Player Category (for category awards)
  player_category VARCHAR(50),          -- 'Attacker', 'Midfielder', 'Defender', 'Goalkeeper' (NULL for individual awards)
  
  -- Performance Stats (optional JSONB for award criteria)
  performance_stats JSONB,
  
  -- Metadata
  awarded_by VARCHAR(50) DEFAULT 'system', -- 'system' (auto) or 'manual' (committee)
  notes TEXT,                              -- Optional notes
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Unique constraint: prevent duplicate awards
  UNIQUE(player_id, season_id, award_category, award_type, award_position)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Fast lookup by player
CREATE INDEX IF NOT EXISTS idx_player_awards_player_id 
ON player_awards(player_id);

-- Fast lookup by season
CREATE INDEX IF NOT EXISTS idx_player_awards_season_id 
ON player_awards(season_id);

-- Fast lookup by award category
CREATE INDEX IF NOT EXISTS idx_player_awards_category 
ON player_awards(award_category);

-- Fast lookup by award type
CREATE INDEX IF NOT EXISTS idx_player_awards_type 
ON player_awards(award_type);

-- Fast lookup by player category
CREATE INDEX IF NOT EXISTS idx_player_awards_player_category 
ON player_awards(player_category);

-- Fast lookup by award position
CREATE INDEX IF NOT EXISTS idx_player_awards_position 
ON player_awards(award_position);

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE player_awards IS 'Tracks individual and category awards for players across all seasons';
COMMENT ON COLUMN player_awards.award_category IS 'Award scope: individual (season-wide) or category (position-specific)';
COMMENT ON COLUMN player_awards.award_type IS 'Award name: Golden Boot, Best Attacker, Player of Season, etc.';
COMMENT ON COLUMN player_awards.award_position IS 'Achievement level: Winner, Runner Up, Third Place (NULL for single-winner awards)';
COMMENT ON COLUMN player_awards.player_category IS 'Player position category (only for category awards): Attacker, Midfielder, Defender, Goalkeeper';
COMMENT ON COLUMN player_awards.awarded_by IS 'system=auto-awarded based on stats, manual=committee awarded';

-- ============================================
-- EXAMPLE DATA STRUCTURE
-- ============================================

-- Individual Awards (season-wide):
-- award_category: 'individual'
-- award_type: 'Golden Boot', 'Player of the Season', 'Most Assists'
-- award_position: 'Winner', 'Runner Up', 'Third Place'
-- player_category: NULL

-- Category Awards (position-specific):
-- award_category: 'category'
-- award_type: 'Best Attacker', 'Best Midfielder', 'Best Defender', 'Best Goalkeeper'
-- award_position: 'Winner', 'Runner Up', 'Third Place'
-- player_category: 'Attacker', 'Midfielder', 'Defender', 'Goalkeeper'

SELECT '✅ player_awards table created successfully!' as status;
