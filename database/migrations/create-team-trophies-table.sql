-- ============================================
-- CREATE TEAM TROPHIES TABLE
-- Tracks team achievements across all seasons
-- Separate from teamstats for better querying
-- ============================================

CREATE TABLE IF NOT EXISTS team_trophies (
  id SERIAL PRIMARY KEY,
  
  -- Team Information
  team_id VARCHAR(255) NOT NULL,
  team_name VARCHAR(255) NOT NULL,
  
  -- Season Context
  season_id VARCHAR(255) NOT NULL,
  
  -- Trophy Details
  trophy_type VARCHAR(50) NOT NULL,  -- 'league', 'cup', 'runner_up', 'special'
  trophy_name VARCHAR(255) NOT NULL, -- e.g., "League Winner", "UCL", "FA Cup", "Runner Up"
  
  -- League Position (if applicable)
  position INTEGER,                  -- League position (1 for winner, 2 for runner-up, etc.)
  
  -- Metadata
  awarded_by VARCHAR(50) DEFAULT 'system', -- 'system' (auto) or 'manual' (committee)
  notes TEXT,                              -- Optional notes from committee
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Unique constraint: prevent duplicate trophies
  UNIQUE(team_id, season_id, trophy_name)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Fast lookup by team
CREATE INDEX IF NOT EXISTS idx_team_trophies_team_id 
ON team_trophies(team_id);

-- Fast lookup by season
CREATE INDEX IF NOT EXISTS idx_team_trophies_season_id 
ON team_trophies(season_id);

-- Fast lookup by trophy type
CREATE INDEX IF NOT EXISTS idx_team_trophies_type 
ON team_trophies(trophy_type);

-- Fast lookup by team across seasons
CREATE INDEX IF NOT EXISTS idx_team_trophies_team_season 
ON team_trophies(team_id, season_id);

-- Fast lookup by trophy name (e.g., all UCL winners)
CREATE INDEX IF NOT EXISTS idx_team_trophies_name 
ON team_trophies(trophy_name);

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE team_trophies IS 'Tracks team achievements and trophies across all seasons';
COMMENT ON COLUMN team_trophies.trophy_type IS 'Type of trophy: league, cup, runner_up, special';
COMMENT ON COLUMN team_trophies.trophy_name IS 'Display name: League Winner, UCL, FA Cup, etc.';
COMMENT ON COLUMN team_trophies.position IS 'League position if applicable (1=winner, 2=runner-up)';
COMMENT ON COLUMN team_trophies.awarded_by IS 'system=auto-awarded, manual=committee awarded';

-- ============================================
-- VERIFICATION QUERY
-- ============================================

SELECT '✅ team_trophies table created successfully!' as status;
