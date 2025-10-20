-- Add MOTM columns to fixtures table
ALTER TABLE fixtures 
ADD COLUMN IF NOT EXISTS motm_player_id TEXT,
ADD COLUMN IF NOT EXISTS motm_player_name TEXT;

-- Remove old man_of_the_match column from matchups table
ALTER TABLE matchups 
DROP COLUMN IF EXISTS man_of_the_match;

-- Verify the changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'fixtures' 
AND column_name LIKE 'motm%';
