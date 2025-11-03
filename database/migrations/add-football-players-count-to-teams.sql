-- Add football_players_count column to teams table
-- This tracks the number of football players in each team's squad

-- Add the column
ALTER TABLE teams
ADD COLUMN IF NOT EXISTS football_players_count INTEGER DEFAULT 0;

-- Add comment
COMMENT ON COLUMN teams.football_players_count IS 'Number of football players in the team squad';

-- Update existing teams with correct counts based on team_players table
UPDATE teams t
SET football_players_count = (
  SELECT COUNT(*)
  FROM team_players tp
  WHERE tp.team_id = t.id
  AND tp.season_id = t.season_id
)
WHERE EXISTS (
  SELECT 1 FROM team_players tp WHERE tp.team_id = t.id
);

-- Verify the update
SELECT 
  id,
  name,
  season_id,
  football_players_count,
  football_budget,
  football_spent
FROM teams
ORDER BY season_id, name;
