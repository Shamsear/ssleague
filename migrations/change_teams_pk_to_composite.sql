-- Migration: Change teams table primary key from (id) to (id, season_id)
-- This allows teams to have multiple season records

-- Step 1: Drop the existing primary key constraint
ALTER TABLE teams DROP CONSTRAINT teams_pkey;

-- Step 2: Add the new composite primary key
ALTER TABLE teams ADD PRIMARY KEY (id, season_id);

-- Step 3: Create an index on id alone for faster lookups by team
CREATE INDEX IF NOT EXISTS idx_teams_id ON teams(id);

-- Step 4: Create an index on season_id for faster lookups by season
CREATE INDEX IF NOT EXISTS idx_teams_season_id ON teams(season_id);

-- Verify the change
SELECT 
    constraint_name, 
    column_name 
FROM information_schema.key_column_usage 
WHERE table_name = 'teams' 
    AND constraint_name LIKE '%pkey%'
ORDER BY ordinal_position;
