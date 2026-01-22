-- Add missing columns to tournaments table
-- These fields are needed for tournament configuration

-- Add rewards column (JSONB to store reward configuration)
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS rewards JSONB DEFAULT NULL;

-- Add number_of_teams column
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS number_of_teams INTEGER DEFAULT 16;

-- Add enable_category_requirements to tournament_settings
ALTER TABLE tournament_settings
ADD COLUMN IF NOT EXISTS enable_category_requirements BOOLEAN DEFAULT FALSE;

-- Add lineup_category_requirements to tournament_settings (JSONB)
ALTER TABLE tournament_settings
ADD COLUMN IF NOT EXISTS lineup_category_requirements JSONB DEFAULT '{}'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN tournaments.rewards IS 'Tournament reward configuration (match results, positions, knockout stages)';
COMMENT ON COLUMN tournaments.number_of_teams IS 'Total number of teams participating in the tournament';
COMMENT ON COLUMN tournament_settings.enable_category_requirements IS 'Whether category requirements are enabled for lineups';
COMMENT ON COLUMN tournament_settings.lineup_category_requirements IS 'Category-specific lineup requirements (e.g., minimum Legend players)';

-- Verify the changes
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'tournaments' AND column_name IN ('rewards', 'number_of_teams')
UNION ALL
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'tournament_settings' AND column_name IN ('enable_category_requirements', 'lineup_category_requirements');
