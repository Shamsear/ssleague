-- Fantasy League Revamp - Phase 3: Transfer & Trading System
-- Rollback Migration: Drop transfer and trade tables
-- Date: 2026-02-26

-- ============================================================================
-- DROP INDEXES
-- ============================================================================

-- Transfer windows indexes
DROP INDEX IF EXISTS idx_fantasy_transfer_windows_times;
DROP INDEX IF EXISTS idx_fantasy_transfer_windows_type;
DROP INDEX IF EXISTS idx_fantasy_transfer_windows_status;
DROP INDEX IF EXISTS idx_fantasy_transfer_windows_league;

-- Trades indexes
DROP INDEX IF EXISTS idx_fantasy_trades_team_b_status;
DROP INDEX IF EXISTS idx_fantasy_trades_team_a_status;
DROP INDEX IF EXISTS idx_fantasy_trades_proposed_at;
DROP INDEX IF EXISTS idx_fantasy_trades_expires;
DROP INDEX IF EXISTS idx_fantasy_trades_status;
DROP INDEX IF EXISTS idx_fantasy_trades_league;
DROP INDEX IF EXISTS idx_fantasy_trades_team_b;
DROP INDEX IF EXISTS idx_fantasy_trades_team_a;

-- Releases indexes
DROP INDEX IF EXISTS idx_fantasy_releases_released_at;
DROP INDEX IF EXISTS idx_fantasy_releases_window;
DROP INDEX IF EXISTS idx_fantasy_releases_league;
DROP INDEX IF EXISTS idx_fantasy_releases_player;
DROP INDEX IF EXISTS idx_fantasy_releases_team;

-- ============================================================================
-- DROP TABLES
-- ============================================================================

DROP TABLE IF EXISTS fantasy_transfer_windows CASCADE;
DROP TABLE IF EXISTS fantasy_trades CASCADE;
DROP TABLE IF EXISTS fantasy_releases CASCADE;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify tables were dropped
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('fantasy_releases', 'fantasy_trades', 'fantasy_transfer_windows');

-- Should return 0 rows if successful
