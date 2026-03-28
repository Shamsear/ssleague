-- Fantasy League Revamp - Draft Tables Rollback Script
-- Phase 1: Core Draft System
-- Created: 2024
-- Description: Rolls back the draft tables migration safely

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
-- This script will:
-- 1. Drop fantasy_tier_bids table (with CASCADE to remove foreign key constraints)
-- 2. Drop fantasy_draft_tiers table
-- 3. Remove added columns from fantasy_leagues table
-- 4. Drop all created indexes
--
-- WARNING: This will delete all draft tier and bid data!
-- Make sure to backup data before running this rollback.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. BACKUP DATA (Optional - uncomment to create backup tables)
-- ============================================================================

-- CREATE TABLE IF NOT EXISTS fantasy_draft_tiers_backup AS 
-- SELECT * FROM fantasy_draft_tiers;

-- CREATE TABLE IF NOT EXISTS fantasy_tier_bids_backup AS 
-- SELECT * FROM fantasy_tier_bids;

RAISE NOTICE 'Starting rollback of fantasy league draft tables migration...';

-- ============================================================================
-- 2. DROP INDEXES
-- ============================================================================

RAISE NOTICE 'Dropping indexes...';

-- Drop indexes for fantasy_tier_bids
DROP INDEX IF EXISTS idx_tier_bids_league_tier;
DROP INDEX IF EXISTS idx_tier_bids_player;
DROP INDEX IF EXISTS idx_tier_bids_status;
DROP INDEX IF EXISTS idx_tier_bids_league;
DROP INDEX IF EXISTS idx_tier_bids_team;
DROP INDEX IF EXISTS idx_tier_bids_tier;

-- Drop indexes for fantasy_draft_tiers
DROP INDEX IF EXISTS idx_draft_tiers_tier_number;
DROP INDEX IF EXISTS idx_draft_tiers_league_type;
DROP INDEX IF EXISTS idx_draft_tiers_type;
DROP INDEX IF EXISTS idx_draft_tiers_league;

RAISE NOTICE 'Indexes dropped successfully';

-- ============================================================================
-- 3. DROP TABLES (CASCADE to handle foreign key constraints)
-- ============================================================================

RAISE NOTICE 'Dropping tables...';

-- Drop fantasy_tier_bids first (has foreign key to fantasy_draft_tiers)
DROP TABLE IF EXISTS fantasy_tier_bids CASCADE;
RAISE NOTICE 'fantasy_tier_bids table dropped';

-- Drop fantasy_draft_tiers
DROP TABLE IF EXISTS fantasy_draft_tiers CASCADE;
RAISE NOTICE 'fantasy_draft_tiers table dropped';

-- ============================================================================
-- 4. REMOVE COLUMNS FROM fantasy_leagues TABLE
-- ============================================================================

RAISE NOTICE 'Removing columns from fantasy_leagues table...';

ALTER TABLE fantasy_leagues 
DROP COLUMN IF EXISTS lineup_lock_hours_before,
DROP COLUMN IF EXISTS lineup_lock_enabled,
DROP COLUMN IF EXISTS number_of_tiers,
DROP COLUMN IF EXISTS starting_lineup_size,
DROP COLUMN IF EXISTS max_squad_size,
DROP COLUMN IF EXISTS min_squad_size;

RAISE NOTICE 'Columns removed from fantasy_leagues table';

-- ============================================================================
-- 5. VERIFICATION
-- ============================================================================

DO $$
BEGIN
  -- Verify tables were dropped
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fantasy_draft_tiers') THEN
    RAISE NOTICE 'SUCCESS: fantasy_draft_tiers table removed';
  ELSE
    RAISE EXCEPTION 'FAILED: fantasy_draft_tiers table still exists';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fantasy_tier_bids') THEN
    RAISE NOTICE 'SUCCESS: fantasy_tier_bids table removed';
  ELSE
    RAISE EXCEPTION 'FAILED: fantasy_tier_bids table still exists';
  END IF;

  -- Verify columns were removed
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fantasy_leagues' 
    AND column_name = 'number_of_tiers'
  ) THEN
    RAISE NOTICE 'SUCCESS: fantasy_leagues columns removed';
  ELSE
    RAISE EXCEPTION 'FAILED: fantasy_leagues columns still exist';
  END IF;
END $$;

-- ============================================================================
-- ROLLBACK COMPLETE
-- ============================================================================

RAISE NOTICE '============================================';
RAISE NOTICE 'Fantasy League Revamp - Draft Tables Rollback Complete';
RAISE NOTICE 'Tables dropped: fantasy_draft_tiers, fantasy_tier_bids';
RAISE NOTICE 'Indexes dropped: 10 indexes';
RAISE NOTICE 'fantasy_leagues columns removed: 6 columns';
RAISE NOTICE '============================================';

COMMIT;

-- If any errors occurred, the transaction will be rolled back automatically
-- and no changes will be applied to the database.
