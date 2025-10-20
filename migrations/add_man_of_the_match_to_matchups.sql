-- Add man_of_the_match column to matchups table
-- This stores which team's player won Man of the Match award for each matchup

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'matchups' 
        AND column_name = 'man_of_the_match'
    ) THEN
        ALTER TABLE matchups 
        ADD COLUMN man_of_the_match VARCHAR(10);
        
        -- Add constraint to ensure valid values
        ALTER TABLE matchups
        ADD CONSTRAINT man_of_the_match_valid 
        CHECK (man_of_the_match IN ('home', 'away') OR man_of_the_match IS NULL);
        
        RAISE NOTICE 'Column man_of_the_match added to matchups table';
    ELSE
        RAISE NOTICE 'Column man_of_the_match already exists';
    END IF;
END $$;

-- Add comment to column
COMMENT ON COLUMN matchups.man_of_the_match IS 'Man of the Match award - which team''s player won (home/away/null)';
