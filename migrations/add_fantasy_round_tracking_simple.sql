-- Simplified Fantasy Round Tracking System
-- All players in squad automatically earn points (no lineup selection needed)

-- Fantasy Rounds Table
-- Links fantasy leagues to tournament rounds for tracking
CREATE TABLE IF NOT EXISTS fantasy_rounds (
  id SERIAL PRIMARY KEY,
  fantasy_round_id VARCHAR(100) UNIQUE NOT NULL,
  league_id VARCHAR(100) NOT NULL REFERENCES fantasy_leagues(league_id),
  round_id VARCHAR(50) NOT NULL, -- Links to rounds.id
  round_number INTEGER NOT NULL,
  round_name VARCHAR(255),
  
  -- Dates
  round_start_date TIMESTAMP,
  round_end_date TIMESTAMP,
  
  -- Status
  is_active BOOLEAN DEFAULT FALSE,
  is_completed BOOLEAN DEFAULT FALSE,
  points_calculated BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(league_id, round_id)
);

-- Update fantasy_player_points to link to specific rounds
ALTER TABLE fantasy_player_points 
ADD COLUMN IF NOT EXISTS fantasy_round_id VARCHAR(100) REFERENCES fantasy_rounds(fantasy_round_id);

-- Add points_breakdown as JSONB for detailed breakdown
ALTER TABLE fantasy_player_points 
ADD COLUMN IF NOT EXISTS points_breakdown JSONB;

-- Add is_vice_captain if not exists (captain already exists)
ALTER TABLE fantasy_player_points 
ADD COLUMN IF NOT EXISTS is_vice_captain BOOLEAN DEFAULT FALSE;

-- Ensure fantasy_squad has captain/VC columns
ALTER TABLE fantasy_squad 
ADD COLUMN IF NOT EXISTS is_captain BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_vice_captain BOOLEAN DEFAULT FALSE;

-- Remove is_starting from fantasy_squad (not needed - all players play)
ALTER TABLE fantasy_squad 
DROP COLUMN IF EXISTS is_starting;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_fantasy_rounds_league ON fantasy_rounds(league_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_rounds_round ON fantasy_rounds(round_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_rounds_active ON fantasy_rounds(is_active);
CREATE INDEX IF NOT EXISTS idx_fantasy_player_points_fantasy_round ON fantasy_player_points(fantasy_round_id);

-- Add comments
COMMENT ON TABLE fantasy_rounds IS 'Links fantasy leagues to tournament rounds for automatic points calculation';
COMMENT ON COLUMN fantasy_rounds.points_calculated IS 'True when points have been calculated for this round';
COMMENT ON COLUMN fantasy_player_points.fantasy_round_id IS 'Links points to specific fantasy round';
COMMENT ON COLUMN fantasy_squad.is_captain IS 'Captain gets 2x points multiplier';
COMMENT ON COLUMN fantasy_squad.is_vice_captain IS 'Vice-captain gets 1.5x points multiplier';
COMMENT ON COLUMN fantasy_player_points.is_captain IS 'Was captain when points were calculated';
COMMENT ON COLUMN fantasy_player_points.is_vice_captain IS 'Was vice-captain when points were calculated';
