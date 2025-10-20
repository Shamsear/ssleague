-- Migration: Move Man of the Match from matchups table to fixtures table
-- MOTM should be one per fixture, not per individual matchup

-- Step 1: Add MOTM fields to fixtures table
DO $$ 
BEGIN
    -- Add motm_player_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'fixtures' 
        AND column_name = 'motm_player_id'
    ) THEN
        ALTER TABLE fixtures 
        ADD COLUMN motm_player_id TEXT;
        
        RAISE NOTICE 'Column motm_player_id added to fixtures table';
    ELSE
        RAISE NOTICE 'Column motm_player_id already exists';
    END IF;
    
    -- Add motm_player_name column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'fixtures' 
        AND column_name = 'motm_player_name'
    ) THEN
        ALTER TABLE fixtures 
        ADD COLUMN motm_player_name TEXT;
        
        RAISE NOTICE 'Column motm_player_name added to fixtures table';
    ELSE
        RAISE NOTICE 'Column motm_player_name already exists';
    END IF;
END $$;

-- Step 2: Migrate existing MOTM data from matchups to fixtures
-- Note: This migration assumes only ONE matchup per fixture has MOTM set
-- If multiple matchups have MOTM, only the first one will be migrated
UPDATE fixtures f
SET 
    motm_player_id = (
        SELECT CASE 
            WHEN m.man_of_the_match = 'home' THEN m.home_player_id
            WHEN m.man_of_the_match = 'away' THEN m.away_player_id
            ELSE NULL
        END
        FROM matchups m
        WHERE m.fixture_id = f.id 
        AND m.man_of_the_match IS NOT NULL
        LIMIT 1
    ),
    motm_player_name = (
        SELECT CASE 
            WHEN m.man_of_the_match = 'home' THEN m.home_player_name
            WHEN m.man_of_the_match = 'away' THEN m.away_player_name
            ELSE NULL
        END
        FROM matchups m
        WHERE m.fixture_id = f.id 
        AND m.man_of_the_match IS NOT NULL
        LIMIT 1
    )
WHERE EXISTS (
    SELECT 1 FROM matchups m 
    WHERE m.fixture_id = f.id 
    AND m.man_of_the_match IS NOT NULL
);

-- Step 3: Drop the man_of_the_match column and constraint from matchups
DO $$ 
BEGIN
    -- Drop constraint first
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'man_of_the_match_valid'
        AND table_name = 'matchups'
    ) THEN
        ALTER TABLE matchups DROP CONSTRAINT man_of_the_match_valid;
        RAISE NOTICE 'Constraint man_of_the_match_valid dropped from matchups';
    END IF;
    
    -- Drop column
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'matchups' 
        AND column_name = 'man_of_the_match'
    ) THEN
        ALTER TABLE matchups DROP COLUMN man_of_the_match;
        RAISE NOTICE 'Column man_of_the_match dropped from matchups table';
    ELSE
        RAISE NOTICE 'Column man_of_the_match does not exist in matchups';
    END IF;
END $$;

-- Add comments
COMMENT ON COLUMN fixtures.motm_player_id IS 'Man of the Match player ID for this fixture';
COMMENT ON COLUMN fixtures.motm_player_name IS 'Man of the Match player name for this fixture';

-- Verification
SELECT 
    'Migration complete!' as status,
    COUNT(*) as fixtures_with_motm
FROM fixtures
WHERE motm_player_id IS NOT NULL;
