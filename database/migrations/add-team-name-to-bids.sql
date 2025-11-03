-- Add team_name column to bids table
-- This allows tiebreakers to access team names without Firebase lookups

-- Add team_name column if it doesn't exist
ALTER TABLE bids 
ADD COLUMN IF NOT EXISTS team_name VARCHAR(255);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_bids_team_name ON bids(team_name);

-- Add comment
COMMENT ON COLUMN bids.team_name IS 'Team name at the time of bid (denormalized for performance)';

SELECT '✅ Migration completed: Added team_name column to bids table' as status;
