-- Fix rounds table ID type from UUID to VARCHAR
-- This fixes the "duplicate key value violates unique constraint" error

BEGIN;

-- Step 1: Drop dependent constraints and indexes
ALTER TABLE IF EXISTS bids DROP CONSTRAINT IF EXISTS bids_round_id_fkey;
DROP INDEX IF EXISTS idx_rounds_season_status;
DROP INDEX IF EXISTS idx_rounds_season_type;
DROP INDEX IF EXISTS idx_rounds_end_time;
DROP INDEX IF EXISTS idx_rounds_position;
DROP INDEX IF EXISTS idx_rounds_round_type;
DROP INDEX IF EXISTS idx_rounds_status;
DROP INDEX IF EXISTS idx_rounds_season_id;

-- Step 2: Change the ID column type
ALTER TABLE rounds ALTER COLUMN id TYPE VARCHAR(255);
ALTER TABLE rounds ALTER COLUMN id DROP DEFAULT;

-- Step 3: Recreate the foreign key constraint
ALTER TABLE bids 
  ADD CONSTRAINT bids_round_id_fkey 
  FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE;

-- Step 4: Recreate indexes
CREATE INDEX idx_rounds_season_id ON rounds(season_id);
CREATE INDEX idx_rounds_status ON rounds(status);
CREATE INDEX idx_rounds_round_type ON rounds(round_type);
CREATE INDEX idx_rounds_position ON rounds(position);
CREATE INDEX idx_rounds_end_time ON rounds(end_time);
CREATE INDEX idx_rounds_season_status ON rounds(season_id, status);
CREATE INDEX idx_rounds_season_type ON rounds(season_id, round_type);

COMMIT;

-- Verify the change
SELECT 
  column_name, 
  data_type, 
  character_maximum_length,
  column_default
FROM information_schema.columns 
WHERE table_name = 'rounds' 
  AND column_name = 'id';
