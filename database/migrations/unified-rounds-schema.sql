-- ============================================
-- UNIFIED ROUNDS TABLE SCHEMA
-- ============================================
-- This migration creates a single unified rounds table
-- that supports both blind bidding and bulk bidding features
-- Run this on your Neon PostgreSQL database

-- ============================================
-- 1. UNIFIED ROUNDS TABLE
-- ============================================
-- Combines features from both 'rounds' (UUID) and 'auction_rounds' (SERIAL) tables
CREATE TABLE IF NOT EXISTS rounds (
  -- Primary key (UUID for compatibility with existing bids table)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic round information
  season_id VARCHAR(255) NOT NULL,
  round_number INTEGER,  -- Optional for specific numbered rounds
  
  -- Position-based rounds (for blind bidding)
  position VARCHAR(50),  -- e.g., 'QB', 'RB', 'WR'
  position_group VARCHAR(10),  -- e.g., 'QB', 'RB'
  
  -- Round type and configuration
  round_type VARCHAR(20) DEFAULT 'normal' CHECK (round_type IN ('normal', 'bulk', 'tiebreaker')),
  max_bids_per_team INTEGER DEFAULT 5,  -- For blind bidding rounds
  base_price INTEGER DEFAULT 10,  -- For bulk rounds
  
  -- Timing
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_seconds INTEGER DEFAULT 300,
  
  -- Status
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'completed', 'tiebreaker', 'cancelled')),
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(season_id, round_number) DEFERRABLE INITIALLY DEFERRED  -- Only applies when round_number is set
);

-- ============================================
-- 2. BIDS TABLE (Already exists, no changes needed)
-- ============================================
-- This table remains unchanged and works with the unified rounds table
CREATE TABLE IF NOT EXISTS bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id VARCHAR(255) NOT NULL,
  player_id VARCHAR(255) NOT NULL,
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount >= 10),
  encrypted_bid_data TEXT,  -- For blind bidding encryption
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'won', 'lost', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. CREATE INDEXES
-- ============================================
-- rounds table indexes
CREATE INDEX IF NOT EXISTS idx_rounds_season_id ON rounds(season_id);
CREATE INDEX IF NOT EXISTS idx_rounds_status ON rounds(status);
CREATE INDEX IF NOT EXISTS idx_rounds_round_type ON rounds(round_type);
CREATE INDEX IF NOT EXISTS idx_rounds_position ON rounds(position);
CREATE INDEX IF NOT EXISTS idx_rounds_end_time ON rounds(end_time);
CREATE INDEX IF NOT EXISTS idx_rounds_season_status ON rounds(season_id, status);
CREATE INDEX IF NOT EXISTS idx_rounds_season_type ON rounds(season_id, round_type);

-- bids table indexes (if not already created)
CREATE INDEX IF NOT EXISTS idx_bids_team_id ON bids(team_id);
CREATE INDEX IF NOT EXISTS idx_bids_player_id ON bids(player_id);
CREATE INDEX IF NOT EXISTS idx_bids_round_id ON bids(round_id);
CREATE INDEX IF NOT EXISTS idx_bids_status ON bids(status);
CREATE INDEX IF NOT EXISTS idx_bids_round_team ON bids(round_id, team_id);
CREATE INDEX IF NOT EXISTS idx_bids_round_status ON bids(round_id, status);

-- Unique constraint: One bid per team per player per round
CREATE UNIQUE INDEX IF NOT EXISTS idx_bids_unique_team_player_round 
ON bids(team_id, player_id, round_id) WHERE status = 'active';

-- ============================================
-- 4. CREATE TRIGGERS
-- ============================================
-- Function to update updated_at timestamp (shared)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for rounds table
DROP TRIGGER IF EXISTS update_rounds_updated_at ON rounds;
CREATE TRIGGER update_rounds_updated_at
  BEFORE UPDATE ON rounds
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for bids table (if not already exists)
DROP TRIGGER IF EXISTS update_bids_updated_at ON bids;
CREATE TRIGGER update_bids_updated_at
  BEFORE UPDATE ON bids
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. ADD COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE rounds IS 'Unified rounds table supporting normal blind bidding, bulk bidding, and tiebreaker rounds';
COMMENT ON COLUMN rounds.round_type IS 'normal (blind bidding), bulk (fixed price multi-player), tiebreaker (auction)';
COMMENT ON COLUMN rounds.status IS 'draft, scheduled, active, completed, tiebreaker, cancelled';
COMMENT ON COLUMN rounds.max_bids_per_team IS 'Used for blind bidding rounds to limit bids per team';
COMMENT ON COLUMN rounds.base_price IS 'Used for bulk rounds as the fixed bid price for all players';
COMMENT ON COLUMN rounds.position IS 'Used for position-specific blind bidding rounds';
COMMENT ON COLUMN rounds.round_number IS 'Sequential round number within a season (optional)';

-- ============================================
-- 6. VIEWS FOR CONVENIENCE
-- ============================================

-- View: Active rounds with statistics
CREATE OR REPLACE VIEW active_rounds_with_stats AS
SELECT 
  r.*,
  COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'active') as total_bids,
  COUNT(DISTINCT b.team_id) FILTER (WHERE b.status = 'active') as teams_bid,
  EXTRACT(EPOCH FROM (r.end_time - NOW()))::INTEGER as seconds_remaining
FROM rounds r
LEFT JOIN bids b ON r.id = b.round_id
WHERE r.status = 'active'
GROUP BY r.id;

-- View: Round summary by type
CREATE OR REPLACE VIEW rounds_by_type AS
SELECT 
  season_id,
  round_type,
  status,
  COUNT(*) as round_count,
  COUNT(*) FILTER (WHERE status = 'active') as active_count,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_count
FROM rounds
GROUP BY season_id, round_type, status;

-- ============================================
-- 7. VERIFICATION QUERIES
-- ============================================
-- Run these to verify the migration was successful:

-- Check if rounds table exists with all columns
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'rounds'
ORDER BY ordinal_position;

-- Check indexes
SELECT 
  indexname, 
  indexdef
FROM pg_indexes
WHERE tablename = 'rounds'
ORDER BY indexname;

-- Check constraints
SELECT
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'rounds'::regclass;

-- Test query: Get all active rounds
SELECT 
  id,
  season_id,
  round_type,
  position,
  status,
  end_time
FROM rounds
WHERE status = 'active'
ORDER BY end_time;
