-- ============================================
-- Quick Fix: Add Bulk Round Columns to Existing Rounds Table
-- ============================================
-- This adds missing columns to support bulk rounds
-- Safe to run even if columns already exist (uses IF NOT EXISTS)

-- 1. Add missing columns
ALTER TABLE rounds
  ADD COLUMN IF NOT EXISTS round_number INTEGER,
  ADD COLUMN IF NOT EXISTS round_type VARCHAR(20) DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS base_price INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER DEFAULT 300,
  ADD COLUMN IF NOT EXISTS start_time TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS position_group VARCHAR(10);

-- 2. Make position nullable (not required for bulk rounds)
ALTER TABLE rounds ALTER COLUMN position DROP NOT NULL;

-- 3. Make end_time nullable (not required for draft rounds)
ALTER TABLE rounds ALTER COLUMN end_time DROP NOT NULL;

-- 4. Add check constraint for round_type
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rounds_round_type_check'
  ) THEN
    ALTER TABLE rounds 
      ADD CONSTRAINT rounds_round_type_check 
      CHECK (round_type IN ('normal', 'bulk', 'tiebreaker'));
  END IF;
END $$;

-- 5. Add unique constraint for season + round_number
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rounds_season_round_unique'
  ) THEN
    ALTER TABLE rounds 
      ADD CONSTRAINT rounds_season_round_unique 
      UNIQUE (season_id, round_number) 
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

-- 6. Add indexes
CREATE INDEX IF NOT EXISTS idx_rounds_round_type ON rounds(round_type);
CREATE INDEX IF NOT EXISTS idx_rounds_season_type ON rounds(season_id, round_type);

-- 7. Ensure updated_at trigger exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_rounds_updated_at ON rounds;
CREATE TRIGGER update_rounds_updated_at
  BEFORE UPDATE ON rounds
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 8. Add helpful comments
COMMENT ON COLUMN rounds.round_type IS 'Type: normal (blind bidding), bulk (fixed price), tiebreaker (auction)';
COMMENT ON COLUMN rounds.round_number IS 'Sequential round number within a season (used for bulk rounds)';
COMMENT ON COLUMN rounds.base_price IS 'Fixed bid price for bulk rounds (default £10)';
COMMENT ON COLUMN rounds.position IS 'Player position for blind bidding rounds (optional for bulk rounds)';

-- ============================================
-- VERIFICATION
-- ============================================

-- Check all columns now exist
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'rounds'
ORDER BY ordinal_position;

-- Expected columns:
-- id, season_id, position, max_bids_per_team, end_time, status, 
-- created_at, updated_at, round_number, round_type, base_price, 
-- duration_seconds, start_time, position_group

SELECT '✅ Migration complete! Rounds table now supports bulk rounds.' as status;
