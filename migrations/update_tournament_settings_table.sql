-- Add missing columns to tournament_settings table
-- These columns are needed for lineup category requirements, rewards, and team count

-- Add lineup category requirements toggle
ALTER TABLE tournament_settings 
ADD COLUMN IF NOT EXISTS enable_category_requirements BOOLEAN DEFAULT false;

-- Add lineup category requirements JSONB column
ALTER TABLE tournament_settings 
ADD COLUMN IF NOT EXISTS lineup_category_requirements JSONB DEFAULT '{}'::jsonb;

-- Add rewards JSONB column (for match rewards, position rewards, knockout rewards)
ALTER TABLE tournament_settings 
ADD COLUMN IF NOT EXISTS rewards JSONB DEFAULT '{}'::jsonb;

-- Add number of teams column
ALTER TABLE tournament_settings 
ADD COLUMN IF NOT EXISTS number_of_teams INTEGER;

-- Add tournament_id column to support multiple tournaments per season
ALTER TABLE tournament_settings 
ADD COLUMN IF NOT EXISTS tournament_id TEXT;

-- Add comments for documentation
COMMENT ON COLUMN tournament_settings.enable_category_requirements IS 'Toggle to enable/disable category-based player requirements in lineups';
COMMENT ON COLUMN tournament_settings.lineup_category_requirements IS 'JSON object defining minimum player counts per category (e.g., {"cat_classic": 2, "cat_legend": 1})';
COMMENT ON COLUMN tournament_settings.rewards IS 'JSON object containing match_results, league_positions, knockout_stages, and completion_bonus rewards';
COMMENT ON COLUMN tournament_settings.number_of_teams IS 'Total number of teams participating in the tournament';
COMMENT ON COLUMN tournament_settings.tournament_id IS 'Reference to tournament ID for multi-tournament support';
