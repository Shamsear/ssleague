-- Add scoring_system field to fixtures table for knockout matches
-- scoring_system: 'goals' (default) or 'wins' (3 points for win, 1 for draw)

ALTER TABLE fixtures 
ADD COLUMN IF NOT EXISTS scoring_system VARCHAR(20) DEFAULT 'goals';

COMMENT ON COLUMN fixtures.scoring_system IS 'Scoring system for knockout: goals (sum of goals) or wins (3 for win, 1 for draw)';

-- Update existing fixtures to have default scoring_system
UPDATE fixtures 
SET scoring_system = 'goals' 
WHERE scoring_system IS NULL;
