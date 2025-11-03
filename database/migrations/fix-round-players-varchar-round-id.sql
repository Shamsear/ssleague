-- ========================================
-- Fix round_players table to use VARCHAR for round_id
-- ========================================
-- This migration updates the round_players table to match the rounds table
-- which uses VARCHAR(50) for IDs (e.g., "SSPSLFBR00001")

BEGIN;

-- Drop the old foreign key constraint if it exists
ALTER TABLE IF EXISTS round_players 
DROP CONSTRAINT IF EXISTS round_players_round_id_fkey;

-- Change round_id column type from INTEGER to VARCHAR(50)
ALTER TABLE round_players 
ALTER COLUMN round_id TYPE VARCHAR(50);

-- Recreate the foreign key constraint
ALTER TABLE round_players
ADD CONSTRAINT round_players_round_id_fkey
FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE;

-- Verify the change
SELECT 
  column_name,
  data_type,
  character_maximum_length
FROM information_schema.columns
WHERE table_name = 'round_players' AND column_name = 'round_id';

COMMIT;
