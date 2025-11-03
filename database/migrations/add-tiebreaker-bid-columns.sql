-- Add missing columns to tiebreakers table
ALTER TABLE tiebreakers
ADD COLUMN IF NOT EXISTS old_bid_amount INTEGER,
ADD COLUMN IF NOT EXISTS new_bid_amount INTEGER,
ADD COLUMN IF NOT EXISTS team_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS team_name VARCHAR(255);

-- Add comment explaining these columns
COMMENT ON COLUMN tiebreakers.old_bid_amount IS 'Original bid amount before tiebreaker';
COMMENT ON COLUMN tiebreakers.new_bid_amount IS 'New bid amount during tiebreaker';
COMMENT ON COLUMN tiebreakers.team_id IS 'Team ID for individual team tiebreaker entries';
COMMENT ON COLUMN tiebreakers.team_name IS 'Team name for display purposes';
