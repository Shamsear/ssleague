-- Fantasy League Revamp - Draft Tables Migration
-- Phase 1: Core Draft System
-- Created: 2024
-- Description: Creates tables for tiered draft system and updates fantasy_leagues configuration

-- ============================================================================
-- 1. CREATE fantasy_draft_tiers TABLE
-- ============================================================================
-- Stores tiered player lists for draft (initial and transfer drafts)

CREATE TABLE IF NOT EXISTS fantasy_draft_tiers (
  id SERIAL PRIMARY KEY,
  tier_id VARCHAR(100) UNIQUE NOT NULL,
  league_id VARCHAR(100) NOT NULL,
  draft_type VARCHAR(20) NOT NULL CHECK (draft_type IN ('initial', 'transfer')),
  tier_number INTEGER NOT NULL,
  tier_name VARCHAR(100),
  player_ids JSONB NOT NULL,
  player_count INTEGER NOT NULL,
  min_points INTEGER,
  max_points INTEGER,
  avg_points DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(league_id, draft_type, tier_number)
);

COMMENT ON TABLE fantasy_draft_tiers IS 'Stores tiered player lists for draft system';
COMMENT ON COLUMN fantasy_draft_tiers.tier_id IS 'Unique identifier for this tier';
COMMENT ON COLUMN fantasy_draft_tiers.league_id IS 'Reference to fantasy league';
COMMENT ON COLUMN fantasy_draft_tiers.draft_type IS 'Type of draft: initial or transfer';
COMMENT ON COLUMN fantasy_draft_tiers.tier_number IS 'Tier number (1 = highest tier)';
COMMENT ON COLUMN fantasy_draft_tiers.tier_name IS 'Display name (e.g., Elite, Stars, Quality)';
COMMENT ON COLUMN fantasy_draft_tiers.player_ids IS 'JSON array of player IDs in this tier';
COMMENT ON COLUMN fantasy_draft_tiers.player_count IS 'Number of players in this tier';
COMMENT ON COLUMN fantasy_draft_tiers.min_points IS 'Minimum points in tier';
COMMENT ON COLUMN fantasy_draft_tiers.max_points IS 'Maximum points in tier';
COMMENT ON COLUMN fantasy_draft_tiers.avg_points IS 'Average points in tier';

-- ============================================================================
-- 2. CREATE fantasy_tier_bids TABLE
-- ============================================================================
-- Stores team bids for each tier

CREATE TABLE IF NOT EXISTS fantasy_tier_bids (
  id SERIAL PRIMARY KEY,
  bid_id VARCHAR(100) UNIQUE NOT NULL,
  tier_id VARCHAR(100) NOT NULL REFERENCES fantasy_draft_tiers(tier_id) ON DELETE CASCADE,
  league_id VARCHAR(100) NOT NULL,
  team_id VARCHAR(100) NOT NULL,
  player_id VARCHAR(100),
  bid_amount DECIMAL(10,2),
  is_skip BOOLEAN DEFAULT FALSE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'skipped')),
  submitted_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP,
  UNIQUE(tier_id, team_id)
);

COMMENT ON TABLE fantasy_tier_bids IS 'Stores team bids for each draft tier';
COMMENT ON COLUMN fantasy_tier_bids.bid_id IS 'Unique identifier for this bid';
COMMENT ON COLUMN fantasy_tier_bids.tier_id IS 'Reference to draft tier';
COMMENT ON COLUMN fantasy_tier_bids.league_id IS 'Reference to fantasy league';
COMMENT ON COLUMN fantasy_tier_bids.team_id IS 'Reference to fantasy team';
COMMENT ON COLUMN fantasy_tier_bids.player_id IS 'Player being bid on (null if skip)';
COMMENT ON COLUMN fantasy_tier_bids.bid_amount IS 'Amount bid (null if skip)';
COMMENT ON COLUMN fantasy_tier_bids.is_skip IS 'True if team skipped this tier';
COMMENT ON COLUMN fantasy_tier_bids.status IS 'Bid status: pending, won, lost, skipped';
COMMENT ON COLUMN fantasy_tier_bids.submitted_at IS 'When bid was submitted';
COMMENT ON COLUMN fantasy_tier_bids.processed_at IS 'When bid was processed';

-- ============================================================================
-- 3. ADD INDEXES FOR PERFORMANCE
-- ============================================================================

-- Indexes for fantasy_draft_tiers
CREATE INDEX IF NOT EXISTS idx_draft_tiers_league ON fantasy_draft_tiers(league_id);
CREATE INDEX IF NOT EXISTS idx_draft_tiers_type ON fantasy_draft_tiers(draft_type);
CREATE INDEX IF NOT EXISTS idx_draft_tiers_league_type ON fantasy_draft_tiers(league_id, draft_type);
CREATE INDEX IF NOT EXISTS idx_draft_tiers_tier_number ON fantasy_draft_tiers(tier_number);

-- Indexes for fantasy_tier_bids
CREATE INDEX IF NOT EXISTS idx_tier_bids_tier ON fantasy_tier_bids(tier_id);
CREATE INDEX IF NOT EXISTS idx_tier_bids_team ON fantasy_tier_bids(team_id);
CREATE INDEX IF NOT EXISTS idx_tier_bids_league ON fantasy_tier_bids(league_id);
CREATE INDEX IF NOT EXISTS idx_tier_bids_status ON fantasy_tier_bids(status);
CREATE INDEX IF NOT EXISTS idx_tier_bids_player ON fantasy_tier_bids(player_id);
CREATE INDEX IF NOT EXISTS idx_tier_bids_league_tier ON fantasy_tier_bids(league_id, tier_id);

-- ============================================================================
-- 4. UPDATE fantasy_leagues TABLE (ADD TIER CONFIG COLUMNS)
-- ============================================================================

-- Add columns for tier configuration
ALTER TABLE fantasy_leagues 
ADD COLUMN IF NOT EXISTS min_squad_size INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS max_squad_size INTEGER DEFAULT 7,
ADD COLUMN IF NOT EXISTS starting_lineup_size INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS number_of_tiers INTEGER DEFAULT 7,
ADD COLUMN IF NOT EXISTS lineup_lock_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS lineup_lock_hours_before INTEGER DEFAULT 2;

COMMENT ON COLUMN fantasy_leagues.min_squad_size IS 'Minimum squad size (default: 5)';
COMMENT ON COLUMN fantasy_leagues.max_squad_size IS 'Maximum squad size (default: 7)';
COMMENT ON COLUMN fantasy_leagues.starting_lineup_size IS 'Number of starting players (default: 5)';
COMMENT ON COLUMN fantasy_leagues.number_of_tiers IS 'Number of draft tiers (default: 7)';
COMMENT ON COLUMN fantasy_leagues.lineup_lock_enabled IS 'Whether lineups auto-lock at deadline';
COMMENT ON COLUMN fantasy_leagues.lineup_lock_hours_before IS 'Hours before round start to lock lineups';

-- ============================================================================
-- 5. VERIFICATION QUERIES
-- ============================================================================

-- Verify tables were created
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fantasy_draft_tiers') THEN
    RAISE NOTICE 'SUCCESS: fantasy_draft_tiers table created';
  ELSE
    RAISE EXCEPTION 'FAILED: fantasy_draft_tiers table not created';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fantasy_tier_bids') THEN
    RAISE NOTICE 'SUCCESS: fantasy_tier_bids table created';
  ELSE
    RAISE EXCEPTION 'FAILED: fantasy_tier_bids table not created';
  END IF;
END $$;

-- Verify indexes were created
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_draft_tiers_league') THEN
    RAISE NOTICE 'SUCCESS: Indexes created on fantasy_draft_tiers';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tier_bids_tier') THEN
    RAISE NOTICE 'SUCCESS: Indexes created on fantasy_tier_bids';
  END IF;
END $$;

-- Verify fantasy_leagues columns were added
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fantasy_leagues' 
    AND column_name = 'number_of_tiers'
  ) THEN
    RAISE NOTICE 'SUCCESS: fantasy_leagues columns added';
  ELSE
    RAISE EXCEPTION 'FAILED: fantasy_leagues columns not added';
  END IF;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Display summary
SELECT 
  'fantasy_draft_tiers' as table_name,
  COUNT(*) as row_count
FROM fantasy_draft_tiers
UNION ALL
SELECT 
  'fantasy_tier_bids' as table_name,
  COUNT(*) as row_count
FROM fantasy_tier_bids;

-- Final success message
DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Fantasy League Revamp - Draft Tables Migration Complete';
  RAISE NOTICE 'Tables created: fantasy_draft_tiers, fantasy_tier_bids';
  RAISE NOTICE 'Indexes created: 10 indexes for performance';
  RAISE NOTICE 'fantasy_leagues updated: 6 new columns added';
  RAISE NOTICE '============================================';
END $$;
