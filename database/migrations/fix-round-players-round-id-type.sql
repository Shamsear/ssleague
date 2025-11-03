-- Fix type mismatch: round_players.round_id should be VARCHAR to match rounds.id
ALTER TABLE round_players 
ALTER COLUMN round_id TYPE VARCHAR(255) USING round_id::VARCHAR;

-- Update the foreign key constraint if it exists
DO $$ 
BEGIN
    -- Drop existing foreign key if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'round_players_round_id_fkey' 
        AND table_name = 'round_players'
    ) THEN
        ALTER TABLE round_players DROP CONSTRAINT round_players_round_id_fkey;
    END IF;
    
    -- Add new foreign key constraint
    ALTER TABLE round_players 
    ADD CONSTRAINT round_players_round_id_fkey 
    FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE;
END $$;

-- Add comment
COMMENT ON COLUMN round_players.round_id IS 'References rounds.id (readable ID format like SSPSLFR00001)';
