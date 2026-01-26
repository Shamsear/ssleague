-- Add knockout_format field to fixtures table
-- This determines how matchups are created for knockout fixtures

-- Add the column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fixtures' 
        AND column_name = 'knockout_format'
    ) THEN
        ALTER TABLE fixtures 
        ADD COLUMN knockout_format VARCHAR(20) DEFAULT 'single_leg';
    END IF;
END $$;

-- Add comment explaining the field
COMMENT ON COLUMN fixtures.knockout_format IS 'Format for knockout fixtures: single_leg (5 matchups), two_leg (home+away), round_robin (25 matchups all vs all)';

-- Update existing knockout fixtures to have default format
UPDATE fixtures 
SET knockout_format = 'single_leg'
WHERE knockout_round IS NOT NULL 
AND knockout_format IS NULL;
