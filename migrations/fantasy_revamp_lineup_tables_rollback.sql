-- Fantasy League Revamp - Phase 2: Weekly Lineup System
-- Rollback Migration: Drop fantasy_lineups table
-- Date: 2024-01-26

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
-- This script reverses the changes made by fantasy_revamp_lineup_tables.sql
-- Run this if you need to undo the lineup tables migration

-- ============================================================================
-- DROP INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_fantasy_lineups_team_round;
DROP INDEX IF EXISTS idx_fantasy_lineups_league_round;
DROP INDEX IF EXISTS idx_fantasy_lineups_deadline;
DROP INDEX IF EXISTS idx_fantasy_lineups_locked;
DROP INDEX IF EXISTS idx_fantasy_lineups_league;
DROP INDEX IF EXISTS idx_fantasy_lineups_round;
DROP INDEX IF EXISTS idx_fantasy_lineups_team;

-- ============================================================================
-- DROP TABLE
-- ============================================================================

DROP TABLE IF EXISTS fantasy_lineups CASCADE;

-- ============================================================================
-- RESTORE fantasy_squad COLUMN (if needed)
-- ============================================================================

-- Restore is_starting column to fantasy_squad if it was removed
ALTER TABLE fantasy_squad ADD COLUMN IF NOT EXISTS is_starting BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify table was dropped
SELECT COUNT(*) as lineup_table_exists
FROM information_schema.tables
WHERE table_name = 'fantasy_lineups';
-- Should return 0

-- Verify is_starting column was restored
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'fantasy_squad' AND column_name = 'is_starting';
-- Should return 'is_starting' if restoration was needed
