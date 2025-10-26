-- ============================================
-- Fix Matchups Table - Add All Missing Columns
-- ============================================
-- Run this migration to ensure the matchups table has all required columns

-- First, check if the table exists and show current structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'matchups'
ORDER BY ordinal_position;

-- Add missing columns if they don't exist
ALTER TABLE matchups 
ADD COLUMN IF NOT EXISTS fixture_id TEXT NOT NULL DEFAULT '';

ALTER TABLE matchups 
ADD COLUMN IF NOT EXISTS home_player_id TEXT;

ALTER TABLE matchups 
ADD COLUMN IF NOT EXISTS home_player_name TEXT;

ALTER TABLE matchups 
ADD COLUMN IF NOT EXISTS away_player_id TEXT;

ALTER TABLE matchups 
ADD COLUMN IF NOT EXISTS away_player_name TEXT;

ALTER TABLE matchups 
ADD COLUMN IF NOT EXISTS position INTEGER;

ALTER TABLE matchups 
ADD COLUMN IF NOT EXISTS created_by TEXT;

ALTER TABLE matchups 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

ALTER TABLE matchups 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

ALTER TABLE matchups 
ADD COLUMN IF NOT EXISTS match_duration INTEGER DEFAULT 6;

ALTER TABLE matchups 
ADD COLUMN IF NOT EXISTS home_goals INTEGER;

ALTER TABLE matchups 
ADD COLUMN IF NOT EXISTS away_goals INTEGER;

ALTER TABLE matchups 
ADD COLUMN IF NOT EXISTS result_entered_by TEXT;

ALTER TABLE matchups 
ADD COLUMN IF NOT EXISTS result_entered_at TIMESTAMP;

-- Remove the default from fixture_id after it's been added
ALTER TABLE matchups ALTER COLUMN fixture_id DROP DEFAULT;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_matchups_fixture_id ON matchups(fixture_id);
CREATE INDEX IF NOT EXISTS idx_matchups_created_by ON matchups(created_by);

-- Add comments for documentation
COMMENT ON COLUMN matchups.fixture_id IS 'ID of the fixture this matchup belongs to';
COMMENT ON COLUMN matchups.match_duration IS 'Duration of the match in minutes (default 6)';
COMMENT ON COLUMN matchups.home_goals IS 'Goals scored by home player';
COMMENT ON COLUMN matchups.away_goals IS 'Goals scored by away player';
COMMENT ON COLUMN matchups.result_entered_by IS 'User ID who entered the match result';
COMMENT ON COLUMN matchups.result_entered_at IS 'Timestamp when result was entered';

-- Verification: Show final structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'matchups'
ORDER BY ordinal_position;

SELECT '✅ Matchups table structure fixed!' as status;
