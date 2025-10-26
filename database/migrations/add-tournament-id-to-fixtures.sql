-- ============================================
-- Add tournament_id Column to Fixtures Table
-- ============================================
-- This migration adds the tournament_id column to link fixtures to tournaments

-- Add tournament_id column
ALTER TABLE fixtures 
ADD COLUMN IF NOT EXISTS tournament_id VARCHAR(255);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_fixtures_tournament ON fixtures(tournament_id);

-- Add comment for documentation
COMMENT ON COLUMN fixtures.tournament_id IS 'References the tournament this fixture belongs to';

-- Verification query
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'fixtures'
  AND column_name = 'tournament_id';

SELECT '✅ tournament_id column added to fixtures table successfully!' as status;
