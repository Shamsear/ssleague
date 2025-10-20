-- Add match_duration column to matchups table
-- This stores the eFootball match duration (6-12 minutes) that teams agree to play

-- Check if column exists and add it if it doesn't
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'matchups' 
        AND column_name = 'match_duration'
    ) THEN
        ALTER TABLE matchups 
        ADD COLUMN match_duration INTEGER DEFAULT 7;
        
        -- Add constraint to ensure valid duration values
        ALTER TABLE matchups
        ADD CONSTRAINT match_duration_valid 
        CHECK (match_duration >= 6 AND match_duration <= 12);
        
        RAISE NOTICE 'Column match_duration added to matchups table';
    ELSE
        RAISE NOTICE 'Column match_duration already exists';
    END IF;
END $$;

-- Add comment to column
COMMENT ON COLUMN matchups.match_duration IS 'eFootball match duration in minutes (half length). Valid values: 6-12';
