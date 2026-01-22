-- Add scoring_type column to tournament_settings table
-- This allows tournaments to use either goal-based or win-based scoring

-- Add the column with default value
ALTER TABLE tournament_settings
ADD COLUMN IF NOT EXISTS scoring_type VARCHAR(20) DEFAULT 'goals'
CHECK (scoring_type IN ('goals', 'wins', 'hybrid'));

-- Set default for any existing records
UPDATE tournament_settings 
SET scoring_type = 'goals' 
WHERE scoring_type IS NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_tournament_settings_scoring_type 
ON tournament_settings(scoring_type);

-- Add comment for documentation
COMMENT ON COLUMN tournament_settings.scoring_type IS 
'Determines how team wins are calculated: goals (total goals), wins (matchup wins), or hybrid (wins with goal tiebreaker)';
