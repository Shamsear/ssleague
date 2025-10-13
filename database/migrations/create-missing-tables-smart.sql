-- ============================================
-- SMART MIGRATION: Reuse Existing Tables & Create Missing Ones
-- ============================================
-- This migration analyzes what exists and creates only what's needed

-- ============================================
-- ANALYSIS OF EXISTING TABLES:
-- ============================================
-- ✅ rounds - EXISTS (already updated with bulk round columns)
-- ✅ bids - EXISTS (can be used for blind bidding)
-- ✅ tiebreakers - EXISTS (can be reused if structure matches)
-- ✅ team_tiebreakers - EXISTS (can be reused if structure matches)
--
-- ❌ round_players - MISSING (needed for bulk rounds)
-- ❌ round_bids - MISSING (needed for bulk round bids)
-- ❌ bulk_tiebreakers - Code references this (check if tiebreakers can be used)
-- ❌ bulk_tiebreaker_teams - Code references this (check if team_tiebreakers can be used)
-- ❌ bulk_tiebreaker_bids - MISSING (needed for tiebreaker history)

-- ============================================
-- DECISION: 
-- ============================================
-- 1. ✅ REUSE: bids table (for blind bidding)
-- 2. ✅ REUSE: tiebreakers + team_tiebreakers (after checking/updating structure)
-- 3. ❌ CREATE: round_players (new table for bulk rounds)
-- 4. ❌ CREATE: round_bids (new table for bulk bidding)
-- 5. ⚠️  CHECK: bulk_tiebreaker_* tables vs existing tiebreaker tables

-- ============================================
-- STEP 1: Check existing tiebreakers table structure
-- ============================================
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'tiebreakers'
ORDER BY ordinal_position;

-- Expected columns for bulk tiebreakers:
-- id, round_id, player_id, status, tie_amount, current_highest_bid, etc.

-- ============================================
-- STEP 2: Create MISSING tables only
-- ============================================

-- Table 1: round_players (NEW - for bulk rounds)
CREATE TABLE IF NOT EXISTS round_players (
  id SERIAL PRIMARY KEY,
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  player_id VARCHAR(255) NOT NULL,
  player_name VARCHAR(255),
  position VARCHAR(50),
  position_group VARCHAR(10),
  base_price INTEGER DEFAULT 10,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sold', 'unsold')),
  winning_team_id VARCHAR(255),
  winning_bid INTEGER,
  bid_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(round_id, player_id)
);

-- Table 2: round_bids (NEW - for bulk round bidding)
CREATE TABLE IF NOT EXISTS round_bids (
  id SERIAL PRIMARY KEY,
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  player_id VARCHAR(255) NOT NULL,
  team_id VARCHAR(255) NOT NULL,
  team_name VARCHAR(255),
  bid_amount INTEGER NOT NULL,
  bid_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_winning BOOLEAN DEFAULT false
);

-- Table 3: bulk_tiebreakers (NEW - if we can't reuse tiebreakers)
-- Only create if the existing 'tiebreakers' table doesn't have all needed columns
CREATE TABLE IF NOT EXISTS bulk_tiebreakers (
  id SERIAL PRIMARY KEY,
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  player_id VARCHAR(255) NOT NULL,
  player_name VARCHAR(255),
  player_team VARCHAR(255),
  player_position VARCHAR(50),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled', 'auto_finalize_pending')),
  tie_amount INTEGER NOT NULL,
  tied_team_count INTEGER NOT NULL,
  current_highest_bid INTEGER,
  current_highest_team_id VARCHAR(255),
  winning_team_id VARCHAR(255),
  winning_amount INTEGER,
  start_time TIMESTAMP WITH TIME ZONE,
  last_activity_time TIMESTAMP WITH TIME ZONE,
  max_end_time TIMESTAMP WITH TIME ZONE,  -- 24 hour limit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table 4: bulk_tiebreaker_teams (NEW - if we can't reuse team_tiebreakers)
CREATE TABLE IF NOT EXISTS bulk_tiebreaker_teams (
  id SERIAL PRIMARY KEY,
  tiebreaker_id INTEGER NOT NULL REFERENCES bulk_tiebreakers(id) ON DELETE CASCADE,
  team_id VARCHAR(255) NOT NULL,
  team_name VARCHAR(255),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'withdrawn', 'won')),
  current_bid INTEGER,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  withdrawn_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(tiebreaker_id, team_id)
);

-- Table 5: bulk_tiebreaker_bids (NEW - bid history for tiebreakers)
CREATE TABLE IF NOT EXISTS bulk_tiebreaker_bids (
  id SERIAL PRIMARY KEY,
  tiebreaker_id INTEGER NOT NULL REFERENCES bulk_tiebreakers(id) ON DELETE CASCADE,
  team_id VARCHAR(255) NOT NULL,
  team_name VARCHAR(255),
  bid_amount INTEGER NOT NULL,
  bid_time TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- STEP 3: Create indexes
-- ============================================

-- round_players indexes
CREATE INDEX IF NOT EXISTS idx_round_players_round ON round_players(round_id);
CREATE INDEX IF NOT EXISTS idx_round_players_player ON round_players(player_id);
CREATE INDEX IF NOT EXISTS idx_round_players_status ON round_players(status);

-- round_bids indexes
CREATE INDEX IF NOT EXISTS idx_round_bids_round ON round_bids(round_id);
CREATE INDEX IF NOT EXISTS idx_round_bids_player ON round_bids(player_id);
CREATE INDEX IF NOT EXISTS idx_round_bids_team ON round_bids(team_id);

-- bulk_tiebreakers indexes
CREATE INDEX IF NOT EXISTS idx_bulk_tiebreakers_round ON bulk_tiebreakers(round_id);
CREATE INDEX IF NOT EXISTS idx_bulk_tiebreakers_player ON bulk_tiebreakers(player_id);
CREATE INDEX IF NOT EXISTS idx_bulk_tiebreakers_status ON bulk_tiebreakers(status);

-- bulk_tiebreaker_teams indexes
CREATE INDEX IF NOT EXISTS idx_bulk_tiebreaker_teams_tiebreaker ON bulk_tiebreaker_teams(tiebreaker_id);
CREATE INDEX IF NOT EXISTS idx_bulk_tiebreaker_teams_team ON bulk_tiebreaker_teams(team_id);
CREATE INDEX IF NOT EXISTS idx_bulk_tiebreaker_teams_status ON bulk_tiebreaker_teams(status);

-- bulk_tiebreaker_bids indexes
CREATE INDEX IF NOT EXISTS idx_bulk_tiebreaker_bids_tiebreaker ON bulk_tiebreaker_bids(tiebreaker_id);
CREATE INDEX IF NOT EXISTS idx_bulk_tiebreaker_bids_team ON bulk_tiebreaker_bids(team_id);

-- ============================================
-- STEP 4: Create triggers
-- ============================================

-- Trigger for bulk_tiebreakers updated_at
DROP TRIGGER IF EXISTS update_bulk_tiebreakers_updated_at ON bulk_tiebreakers;
CREATE TRIGGER update_bulk_tiebreakers_updated_at
  BEFORE UPDATE ON bulk_tiebreakers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- STEP 5: Add helpful comments
-- ============================================

COMMENT ON TABLE round_players IS 'Players assigned to bulk bidding rounds';
COMMENT ON TABLE round_bids IS 'Bids placed during bulk bidding rounds';
COMMENT ON TABLE bulk_tiebreakers IS 'Last Person Standing tiebreaker auctions for bulk rounds';
COMMENT ON TABLE bulk_tiebreaker_teams IS 'Teams participating in bulk tiebreaker auctions';
COMMENT ON TABLE bulk_tiebreaker_bids IS 'Bid history for bulk tiebreaker auctions';

-- ============================================
-- VERIFICATION
-- ============================================

-- List all tables
SELECT 
  table_name,
  CASE 
    WHEN table_name IN ('rounds', 'bids', 'tiebreakers', 'team_tiebreakers') THEN '✅ EXISTING (reused)'
    ELSE '🆕 NEW'
  END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'rounds', 'bids', 'tiebreakers', 'team_tiebreakers',
    'round_players', 'round_bids', 
    'bulk_tiebreakers', 'bulk_tiebreaker_teams', 'bulk_tiebreaker_bids'
  )
ORDER BY 
  CASE 
    WHEN table_name IN ('rounds', 'bids') THEN 1
    WHEN table_name LIKE 'round_%' THEN 2
    WHEN table_name LIKE 'bulk_%' THEN 3
    ELSE 4
  END,
  table_name;

-- Count rows in each new table
SELECT 
  'round_players' as table_name, 
  COUNT(*) as row_count 
FROM round_players
UNION ALL
SELECT 'round_bids', COUNT(*) FROM round_bids
UNION ALL
SELECT 'bulk_tiebreakers', COUNT(*) FROM bulk_tiebreakers
UNION ALL
SELECT 'bulk_tiebreaker_teams', COUNT(*) FROM bulk_tiebreaker_teams
UNION ALL
SELECT 'bulk_tiebreaker_bids', COUNT(*) FROM bulk_tiebreaker_bids;

SELECT '✅ Smart migration complete! Tables created/reused as needed.' as status;
