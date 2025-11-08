-- Add league stage column to tournaments table
-- This makes the format explicit: league, group, or neither (pure knockout)

ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS has_league_stage BOOLEAN DEFAULT true;

-- Update existing tournaments based on current state
-- If has_group_stage = true, then has_league_stage = false
-- If has_group_stage = false and is_pure_knockout = false, then has_league_stage = true
-- If is_pure_knockout = true, then has_league_stage = false
UPDATE tournaments 
SET has_league_stage = CASE
    WHEN has_group_stage = true THEN false
    WHEN is_pure_knockout = true THEN false
    ELSE true
END
WHERE has_league_stage IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN tournaments.has_league_stage IS 'Whether this tournament has a league/round-robin stage. Mutually exclusive with has_group_stage.';
