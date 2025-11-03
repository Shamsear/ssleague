-- Add budget columns to teams table to mirror Firebase structure
-- This makes it easier to keep budgets in sync
-- Note: Only including football-related budgets as this is a football auction

-- Add budget columns
ALTER TABLE teams
ADD COLUMN IF NOT EXISTS football_budget INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS football_spent INTEGER DEFAULT 0;

-- Add comments
COMMENT ON COLUMN teams.football_budget IS 'Football player budget (mirrors Firebase team_seasons.football_budget)';
COMMENT ON COLUMN teams.football_spent IS 'Amount spent on football players (mirrors Firebase team_seasons.football_spent)';
