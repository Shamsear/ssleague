-- Add MOTM (Man of the Match) and penalty goals columns to fixtures table
-- These columns store match-level data that affects fantasy scoring

-- Add MOTM player columns
ALTER TABLE fixtures 
ADD COLUMN IF NOT EXISTS motm_player_id TEXT,
ADD COLUMN IF NOT EXISTS motm_player_name TEXT;

-- Add penalty goals columns (for fantasy fine calculation)
ALTER TABLE fixtures
ADD COLUMN IF NOT EXISTS home_penalty_goals INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS away_penalty_goals INTEGER DEFAULT 0;

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_fixtures_motm ON fixtures(motm_player_id);

-- Add comment for documentation
COMMENT ON COLUMN fixtures.motm_player_id IS 'Player ID who won Man of the Match';
COMMENT ON COLUMN fixtures.motm_player_name IS 'Player name who won Man of the Match';
COMMENT ON COLUMN fixtures.home_penalty_goals IS 'Number of penalty goals by home team (used for fantasy fines)';
COMMENT ON COLUMN fixtures.away_penalty_goals IS 'Number of penalty goals by away team (used for fantasy fines)';
