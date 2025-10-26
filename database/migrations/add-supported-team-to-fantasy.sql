-- Add supported team columns to fantasy_teams
-- This allows fantasy teams to select which real team they're supporting
-- and earn passive points based on that team's performance

ALTER TABLE fantasy_teams 
ADD COLUMN IF NOT EXISTS supported_team_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS supported_team_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS passive_points INTEGER DEFAULT 0;

-- Add index for supported team lookups
CREATE INDEX IF NOT EXISTS idx_fantasy_teams_supported_team ON fantasy_teams(supported_team_id);

-- Add comment
COMMENT ON COLUMN fantasy_teams.supported_team_id IS 'The real team this fantasy team is supporting for passive points';
COMMENT ON COLUMN fantasy_teams.passive_points IS 'Points earned from supported team performance';
