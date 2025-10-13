-- ============================================
-- Create Missing Tables
-- ============================================
-- These tables are referenced in your code but don't exist in the database

-- ============================================
-- 1. ROUND_PLAYERS TABLE
-- ============================================
-- Players assigned to specific rounds (for bulk rounds)
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

-- ============================================
-- 2. ROUND_BIDS TABLE
-- ============================================
-- Bids placed during bulk rounds
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

-- ============================================
-- 3. BULK_TIEBREAKERS TABLE
-- ============================================
-- Last Person Standing tiebreaker auctions
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

-- ============================================
-- 4. BULK_TIEBREAKER_TEAMS TABLE
-- ============================================
-- Teams participating in tiebreaker auctions
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

-- ============================================
-- 5. BULK_TIEBREAKER_BIDS TABLE
-- ============================================
-- Bid history for tiebreaker auctions
CREATE TABLE IF NOT EXISTS bulk_tiebreaker_bids (
  id SERIAL PRIMARY KEY,
  tiebreaker_id INTEGER NOT NULL REFERENCES bulk_tiebreakers(id) ON DELETE CASCADE,
  team_id VARCHAR(255) NOT NULL,
  team_name VARCHAR(255),
  bid_amount INTEGER NOT NULL,
  bid_time TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 6. CREATE INDEXES
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
-- 7. CREATE TRIGGERS
-- ============================================

-- Trigger for bulk_tiebreakers updated_at
DROP TRIGGER IF EXISTS update_bulk_tiebreakers_updated_at ON bulk_tiebreakers;
CREATE TRIGGER update_bulk_tiebreakers_updated_at
  BEFORE UPDATE ON bulk_tiebreakers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 8. ADD COMMENTS
-- ============================================

COMMENT ON TABLE round_players IS 'Players assigned to bulk bidding rounds';
COMMENT ON TABLE round_bids IS 'Bids placed during bulk bidding rounds';
COMMENT ON TABLE bulk_tiebreakers IS 'Last Person Standing tiebreaker auctions';
COMMENT ON TABLE bulk_tiebreaker_teams IS 'Teams participating in tiebreaker auctions';
COMMENT ON TABLE bulk_tiebreaker_bids IS 'Bid history for tiebreaker auctions';

-- ============================================
-- VERIFICATION
-- ============================================

-- Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('round_players', 'round_bids', 'bulk_tiebreakers', 'bulk_tiebreaker_teams', 'bulk_tiebreaker_bids')
ORDER BY table_name;

SELECT '✅ All missing tables created successfully!' as status;
