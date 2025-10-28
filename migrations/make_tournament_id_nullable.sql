-- Make tournament_id nullable in teamstats table
-- This is needed because teams register before tournaments are created

-- Step 1: Check if tournament_id is in the primary key
-- If it is, we need to drop and recreate the primary key

-- Drop the primary key if it includes tournament_id
ALTER TABLE teamstats DROP CONSTRAINT IF EXISTS teamstats_pkey;

-- Recreate primary key without tournament_id (using id column only)
ALTER TABLE teamstats ADD PRIMARY KEY (id);

-- Make tournament_id nullable
ALTER TABLE teamstats ALTER COLUMN tournament_id DROP NOT NULL;

-- Add index for tournament_id lookups
CREATE INDEX IF NOT EXISTS idx_teamstats_tournament ON teamstats(tournament_id);

-- Add index for the existing UNIQUE constraint to maintain query performance
CREATE INDEX IF NOT EXISTS idx_teamstats_team_season ON teamstats(team_id, season_id);
