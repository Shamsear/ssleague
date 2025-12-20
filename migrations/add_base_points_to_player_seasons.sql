-- Add base_points column to player_seasons table
-- This column stores the starting points for a player at the beginning of a season
-- Used to calculate point changes (increase/decrease) during the season

ALTER TABLE player_seasons 
ADD COLUMN IF NOT EXISTS base_points INTEGER DEFAULT 0;

-- Add comment to explain the column
COMMENT ON COLUMN player_seasons.base_points IS 'Starting points for the player at the beginning of the season. Used to track point changes.';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_player_seasons_base_points ON player_seasons(base_points);
