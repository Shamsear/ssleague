-- Remove season_id from owners table
-- Owners are now team-level only, not season-specific

-- Drop indexes related to season_id
DROP INDEX IF EXISTS idx_owners_season_id;
DROP INDEX IF EXISTS idx_owners_team_season;

-- Drop the season_id column
ALTER TABLE owners DROP COLUMN IF EXISTS season_id;

-- Update comment
COMMENT ON TABLE owners IS 'Stores team owner information - one owner per team across all seasons';
