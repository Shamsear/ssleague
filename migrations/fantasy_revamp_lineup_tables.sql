-- Fantasy League Revamp - Phase 2: Weekly Lineup System
-- Migration: Create fantasy_lineups table
-- Date: 2024-01-26

-- ============================================================================
-- CREATE fantasy_lineups TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS fantasy_lineups (
  id SERIAL PRIMARY KEY,
  lineup_id VARCHAR(100) UNIQUE NOT NULL,
  league_id VARCHAR(100) NOT NULL,
  team_id VARCHAR(100) NOT NULL,
  round_id VARCHAR(100) NOT NULL,
  round_number INTEGER NOT NULL,
  
  -- Lineup composition (JSONB arrays of player IDs)
  starting_players JSONB NOT NULL DEFAULT '[]'::jsonb,
  bench_players JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Captain selections
  captain_id VARCHAR(100) NOT NULL,
  vice_captain_id VARCHAR(100) NOT NULL,
  
  -- Lock status
  is_locked BOOLEAN DEFAULT FALSE,
  locked_at TIMESTAMP,
  lock_deadline TIMESTAMP NOT NULL,
  
  -- Points (calculated after round completes)
  total_points DECIMAL(10,2) DEFAULT 0,
  captain_points DECIMAL(10,2) DEFAULT 0,
  vice_captain_points DECIMAL(10,2) DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_team_round_lineup UNIQUE(league_id, team_id, round_id),
  CONSTRAINT check_starting_players_count CHECK (jsonb_array_length(starting_players) = 5),
  CONSTRAINT check_captain_in_starting CHECK (starting_players @> to_jsonb(captain_id)),
  CONSTRAINT check_vice_captain_in_starting CHECK (starting_players @> to_jsonb(vice_captain_id)),
  CONSTRAINT check_captain_not_vice_captain CHECK (captain_id != vice_captain_id)
);

-- ============================================================================
-- CREATE INDEXES
-- ============================================================================

-- Index for querying lineups by team
CREATE INDEX IF NOT EXISTS idx_fantasy_lineups_team 
ON fantasy_lineups(team_id);

-- Index for querying lineups by round
CREATE INDEX IF NOT EXISTS idx_fantasy_lineups_round 
ON fantasy_lineups(round_id);

-- Index for querying lineups by league
CREATE INDEX IF NOT EXISTS idx_fantasy_lineups_league 
ON fantasy_lineups(league_id);

-- Index for querying locked lineups
CREATE INDEX IF NOT EXISTS idx_fantasy_lineups_locked 
ON fantasy_lineups(is_locked);

-- Index for querying lineups by deadline (for auto-lock)
CREATE INDEX IF NOT EXISTS idx_fantasy_lineups_deadline 
ON fantasy_lineups(lock_deadline) WHERE is_locked = FALSE;

-- Composite index for league + round queries
CREATE INDEX IF NOT EXISTS idx_fantasy_lineups_league_round 
ON fantasy_lineups(league_id, round_id);

-- Composite index for team + round queries
CREATE INDEX IF NOT EXISTS idx_fantasy_lineups_team_round 
ON fantasy_lineups(team_id, round_id);

-- ============================================================================
-- UPDATE fantasy_squad TABLE (if needed)
-- ============================================================================

-- Remove is_starting column if it exists (no longer needed with lineup system)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fantasy_squad' 
    AND column_name = 'is_starting'
  ) THEN
    ALTER TABLE fantasy_squad DROP COLUMN is_starting;
  END IF;
END $$;

-- ============================================================================
-- ADD COMMENTS
-- ============================================================================

COMMENT ON TABLE fantasy_lineups IS 'Weekly lineup submissions for fantasy teams';
COMMENT ON COLUMN fantasy_lineups.lineup_id IS 'Unique identifier for the lineup';
COMMENT ON COLUMN fantasy_lineups.starting_players IS 'JSONB array of 5 player IDs in starting lineup';
COMMENT ON COLUMN fantasy_lineups.bench_players IS 'JSONB array of remaining squad players on bench';
COMMENT ON COLUMN fantasy_lineups.captain_id IS 'Player ID of captain (2x points multiplier)';
COMMENT ON COLUMN fantasy_lineups.vice_captain_id IS 'Player ID of vice-captain (1.5x points multiplier)';
COMMENT ON COLUMN fantasy_lineups.is_locked IS 'Whether lineup is locked (cannot be edited)';
COMMENT ON COLUMN fantasy_lineups.lock_deadline IS 'Deadline for lineup submission';
COMMENT ON COLUMN fantasy_lineups.total_points IS 'Total points earned by this lineup';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify table was created
SELECT 
  table_name, 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'fantasy_lineups'
ORDER BY ordinal_position;

-- Verify indexes were created
SELECT 
  indexname, 
  indexdef
FROM pg_indexes
WHERE tablename = 'fantasy_lineups'
ORDER BY indexname;

-- ============================================================================
-- ROLLBACK SCRIPT (save separately as fantasy_revamp_lineup_tables_rollback.sql)
-- ============================================================================

/*
-- To rollback this migration, run:

-- Drop indexes
DROP INDEX IF EXISTS idx_fantasy_lineups_team_round;
DROP INDEX IF EXISTS idx_fantasy_lineups_league_round;
DROP INDEX IF EXISTS idx_fantasy_lineups_deadline;
DROP INDEX IF EXISTS idx_fantasy_lineups_locked;
DROP INDEX IF EXISTS idx_fantasy_lineups_league;
DROP INDEX IF EXISTS idx_fantasy_lineups_round;
DROP INDEX IF EXISTS idx_fantasy_lineups_team;

-- Drop table
DROP TABLE IF EXISTS fantasy_lineups;

-- Restore is_starting column to fantasy_squad if needed
ALTER TABLE fantasy_squad ADD COLUMN IF NOT EXISTS is_starting BOOLEAN DEFAULT FALSE;
*/
