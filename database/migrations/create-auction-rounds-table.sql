-- ============================================
-- Create Auction Rounds Tables
-- ============================================
-- This migration creates the auction_rounds table structure
-- Run this on your Neon PostgreSQL database

-- Drop existing tables if you want a clean slate (DANGEROUS - removes data!)
-- Uncomment the following lines ONLY if you want to start fresh:
-- DROP TABLE IF EXISTS round_bids CASCADE;
-- DROP TABLE IF NOT EXISTS round_players CASCADE;
-- DROP TABLE IF EXISTS auction_rounds CASCADE;

-- ============================================
-- 1. AUCTION_ROUNDS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS auction_rounds (
    id SERIAL PRIMARY KEY,
    season_id VARCHAR(255) NOT NULL,
    round_number INTEGER NOT NULL,
    position VARCHAR(50),
    position_group VARCHAR(10),
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'completed', 'cancelled')),
    round_type VARCHAR(20) DEFAULT 'normal' CHECK (round_type IN ('normal', 'bulk', 'tiebreaker')),
    base_price INTEGER DEFAULT 10,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    duration_seconds INTEGER DEFAULT 300,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(season_id, round_number)
);

-- ============================================
-- 2. ROUND_PLAYERS TABLE
-- ============================================
-- Players assigned to a specific round
CREATE TABLE IF NOT EXISTS round_players (
    id SERIAL PRIMARY KEY,
    round_id INTEGER REFERENCES auction_rounds(id) ON DELETE CASCADE,
    player_id VARCHAR(255) NOT NULL,
    player_name VARCHAR(255),
    position VARCHAR(50),
    position_group VARCHAR(10),
    base_price INTEGER,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sold', 'unsold')),
    winning_team_id VARCHAR(255),
    winning_bid INTEGER,
    bid_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(round_id, player_id)
);

-- ============================================
-- 3. ROUND_BIDS TABLE
-- ============================================
-- Track all bids during a round (for bulk rounds)
CREATE TABLE IF NOT EXISTS round_bids (
    id SERIAL PRIMARY KEY,
    round_id INTEGER REFERENCES auction_rounds(id) ON DELETE CASCADE,
    player_id VARCHAR(255) NOT NULL,
    team_id VARCHAR(255) NOT NULL,
    team_name VARCHAR(255),
    bid_amount INTEGER NOT NULL,
    bid_time TIMESTAMP DEFAULT NOW(),
    is_winning BOOLEAN DEFAULT false
);

-- ============================================
-- 4. CREATE INDEXES
-- ============================================
-- auction_rounds indexes
CREATE INDEX IF NOT EXISTS idx_auction_rounds_season ON auction_rounds(season_id);
CREATE INDEX IF NOT EXISTS idx_auction_rounds_status ON auction_rounds(status);
CREATE INDEX IF NOT EXISTS idx_auction_rounds_round_type ON auction_rounds(round_type);
CREATE INDEX IF NOT EXISTS idx_auction_rounds_season_status ON auction_rounds(season_id, status);

-- round_players indexes
CREATE INDEX IF NOT EXISTS idx_round_players_round ON round_players(round_id);
CREATE INDEX IF NOT EXISTS idx_round_players_player ON round_players(player_id);
CREATE INDEX IF NOT EXISTS idx_round_players_status ON round_players(status);

-- round_bids indexes
CREATE INDEX IF NOT EXISTS idx_round_bids_round ON round_bids(round_id);
CREATE INDEX IF NOT EXISTS idx_round_bids_player ON round_bids(player_id);
CREATE INDEX IF NOT EXISTS idx_round_bids_team ON round_bids(team_id);

-- ============================================
-- 5. CREATE TRIGGERS
-- ============================================
-- Trigger to update updated_at timestamp for auction_rounds
CREATE OR REPLACE FUNCTION update_auction_rounds_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_auction_rounds_updated_at ON auction_rounds;
CREATE TRIGGER update_auction_rounds_updated_at 
    BEFORE UPDATE ON auction_rounds
    FOR EACH ROW
    EXECUTE FUNCTION update_auction_rounds_updated_at();

-- ============================================
-- 6. ADD COMMENTS
-- ============================================
COMMENT ON TABLE auction_rounds IS 'Main auction rounds table for bulk and normal bidding';
COMMENT ON TABLE round_players IS 'Players assigned to each auction round';
COMMENT ON TABLE round_bids IS 'All bids placed during rounds';
COMMENT ON COLUMN auction_rounds.status IS 'draft, scheduled, active, completed, cancelled';
COMMENT ON COLUMN auction_rounds.round_type IS 'normal, bulk, tiebreaker';
COMMENT ON COLUMN round_players.status IS 'pending, sold, unsold';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify the tables were created successfully:

-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('auction_rounds', 'round_players', 'round_bids')
ORDER BY table_name;

-- Check indexes
SELECT 
    tablename, 
    indexname, 
    indexdef
FROM pg_indexes
WHERE tablename IN ('auction_rounds', 'round_players', 'round_bids')
ORDER BY tablename, indexname;

-- Check triggers
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table
FROM information_schema.triggers
WHERE event_object_table = 'auction_rounds';
