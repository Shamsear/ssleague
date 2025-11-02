-- Ensure goals_conceded column exists in player_seasons table
-- This column is needed for tracking defensive stats

ALTER TABLE player_seasons 
ADD COLUMN IF NOT EXISTS goals_conceded INTEGER DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN player_seasons.goals_conceded IS 'Number of goals conceded by player in the season';
