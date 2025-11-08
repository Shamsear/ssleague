-- Add tournament format columns to fixtures table
-- These columns are needed to distinguish between different tournament formats

-- Add group_name column for group stage tournaments
ALTER TABLE fixtures 
ADD COLUMN IF NOT EXISTS group_name VARCHAR(10);

-- Add knockout_round column for knockout stage tournaments
ALTER TABLE fixtures 
ADD COLUMN IF NOT EXISTS knockout_round VARCHAR(50);

-- Add comments for documentation
COMMENT ON COLUMN fixtures.group_name IS 'Group identifier for group stage fixtures (e.g., A, B, C, D)';
COMMENT ON COLUMN fixtures.knockout_round IS 'Knockout round name (e.g., Final, Semi-Final, Quarter-Final, Round of 16)';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_fixtures_group_name ON fixtures(group_name) WHERE group_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fixtures_knockout_round ON fixtures(knockout_round) WHERE knockout_round IS NOT NULL;

-- Verify the columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'fixtures'
AND column_name IN ('group_name', 'knockout_round');
