-- ============================================================================
-- Fantasy League Revamp - Lineup Tables Migration Test Script
-- ============================================================================
-- Description: Tests the fantasy_lineups table migration
-- 
-- Usage: Run this after applying the migration to verify everything works
-- 
-- Tests:
-- 1. Table structure validation
-- 2. Index validation
-- 3. Constraint validation
-- 4. Insert/Update/Delete operations
-- 5. Query performance
-- ============================================================================

-- ============================================================================
-- TEST 1: TABLE STRUCTURE VALIDATION
-- ============================================================================

DO $$
DECLARE
  column_count INTEGER;
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'TEST 1: Table Structure Validation';
  RAISE NOTICE '============================================================================';
  
  -- Check if table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'fantasy_lineups'
  ) THEN
    RAISE EXCEPTION 'FAILED: fantasy_lineups table does not exist';
  END IF;
  
  -- Check column count
  SELECT COUNT(*) INTO column_count
  FROM information_schema.columns
  WHERE table_name = 'fantasy_lineups';
  
  IF column_count >= 14 THEN
    RAISE NOTICE 'PASSED: fantasy_lineups has % columns', column_count;
  ELSE
    RAISE EXCEPTION 'FAILED: fantasy_lineups has only % columns (expected 14+)', column_count;
  END IF;
  
  -- Check specific columns exist
  I