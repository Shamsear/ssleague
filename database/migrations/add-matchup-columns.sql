-- ============================================
-- Add Missing Columns to Matchups Table
-- ============================================
-- This migration adds columns that are used by the matchups API but were missing from the initial schema

-- Add match duration column (used when creating/updating matchups)
ALTER TABLE matchups 
ADD COLUMN IF NOT EXISTS match_duration INTEGER DEFAULT 6;

-- Add goals/score columns (used when entering results via PATCH endpoint)
ALTER TABLE matchups 
ADD COLUMN IF NOT EXISTS home_goals INTEGER;

ALTER TABLE matchups 
ADD COLUMN IF NOT EXISTS away_goals INTEGER;

-- Add result tracking columns (who entered the result and when)
ALTER TABLE matchups 
ADD COLUMN IF NOT EXISTS result_entered_by TEXT;

ALTER TABLE matchups 
ADD COLUMN IF NOT EXISTS result_entered_at TIMESTAMP;

-- Add comments for documentation
COMMENT ON COLUMN matchups.match_duration IS 'Duration of the match in minutes (default 6)';
COMMENT ON COLUMN matchups.home_goals IS 'Goals scored by home player';
COMMENT ON COLUMN matchups.away_goals IS 'Goals scored by away player';
COMMENT ON COLUMN matchups.result_entered_by IS 'User ID who entered the match result';
COMMENT ON COLUMN matchups.result_entered_at IS 'Timestamp when result was entered';

-- Verification query
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'matchups'
  AND column_name IN ('match_duration', 'home_goals', 'away_goals', 'result_entered_by', 'result_entered_at')
ORDER BY ordinal_position;

SELECT '✅ Matchups table columns added successfully!' as status;
