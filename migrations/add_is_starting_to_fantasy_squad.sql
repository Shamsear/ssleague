-- Add is_starting column to fantasy_squad table for lineup selection
ALTER TABLE fantasy_squad 
ADD COLUMN IF NOT EXISTS is_starting BOOLEAN DEFAULT true;

-- Add comment
COMMENT ON COLUMN fantasy_squad.is_starting IS 'Whether this player is in the starting lineup (true) or on the bench (false)';

-- Set all existing players as starting by default
UPDATE fantasy_squad 
SET is_starting = true 
WHERE is_starting IS NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_fantasy_squad_starting ON fantasy_squad(team_id, is_starting);
