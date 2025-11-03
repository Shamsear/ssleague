-- First, check what columns exist in the starred_players table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'starred_players'
ORDER BY ordinal_position;

-- If the table exists but is missing the team_id column, add it
ALTER TABLE starred_players 
ADD COLUMN IF NOT EXISTS team_id VARCHAR(255);

-- Make the column NOT NULL (after adding it)
-- Note: This will fail if there's existing data without team_id values
-- If you have existing data, you'll need to populate team_id first
ALTER TABLE starred_players 
ALTER COLUMN team_id SET NOT NULL;

-- Add unique constraint if it doesn't exist
-- First drop the constraint if it exists with a different name
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'starred_players_team_id_player_id_key'
    ) THEN
        ALTER TABLE starred_players 
        ADD CONSTRAINT starred_players_team_id_player_id_key 
        UNIQUE(team_id, player_id);
    END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_starred_players_team_id ON starred_players(team_id);
CREATE INDEX IF NOT EXISTS idx_starred_players_player_id ON starred_players(player_id);
CREATE INDEX IF NOT EXISTS idx_starred_players_team_player ON starred_players(team_id, player_id);

-- Verify the changes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'starred_players'
ORDER BY ordinal_position;
