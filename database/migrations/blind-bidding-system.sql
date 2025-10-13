-- ============================================
-- Blind Bidding System - Database Migration
-- ============================================
-- This migration creates all necessary tables for the blind bidding auction system
-- Run this on your Neon PostgreSQL database

-- ============================================
-- 1. ROUNDS TABLE
-- ============================================
-- Stores bidding rounds for each position
CREATE TABLE IF NOT EXISTS rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id VARCHAR(255) NOT NULL,
  position VARCHAR(50) NOT NULL,
  max_bids_per_team INTEGER NOT NULL DEFAULT 5,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'tiebreaker', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for rounds table
CREATE INDEX IF NOT EXISTS idx_rounds_season_id ON rounds(season_id);
CREATE INDEX IF NOT EXISTS idx_rounds_status ON rounds(status);
CREATE INDEX IF NOT EXISTS idx_rounds_end_time ON rounds(end_time);
CREATE INDEX IF NOT EXISTS idx_rounds_season_status ON rounds(season_id, status);

-- ============================================
-- 2. BIDS TABLE
-- ============================================
-- Stores all bids placed by teams
CREATE TABLE IF NOT EXISTS bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id VARCHAR(255) NOT NULL,
  player_id VARCHAR(255) NOT NULL,
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount >= 10),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'won', 'lost', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for bids table
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
-- 3. TEAM_PLAYERS TABLE
-- ============================================
-- Stores players acquired by teams (after winning bids)
CREATE TABLE IF NOT EXISTS team_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id VARCHAR(255) NOT NULL,
  player_id VARCHAR(255) NOT NULL,
  purchase_price INTEGER NOT NULL,
  acquired_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for team_players table
CREATE INDEX IF NOT EXISTS idx_team_players_team_id ON team_players(team_id);
CREATE INDEX IF NOT EXISTS idx_team_players_player_id ON team_players(player_id);

-- Unique constraint: One player per team
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_players_unique 
ON team_players(team_id, player_id);

-- ============================================
-- 4. TEAMS TABLE (Enhanced)
-- ============================================
-- Stores team information with budget tracking
CREATE TABLE IF NOT EXISTS teams (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  budget_remaining INTEGER DEFAULT 100000,
  total_budget INTEGER DEFAULT 100000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for teams table
CREATE INDEX IF NOT EXISTS idx_teams_name ON teams(name);

-- ============================================
-- 5. STARRED_PLAYERS TABLE
-- ============================================
-- Stores players marked as favorites by teams
CREATE TABLE IF NOT EXISTS starred_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id VARCHAR(255) NOT NULL,
  player_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for starred_players table
CREATE INDEX IF NOT EXISTS idx_starred_players_team_id ON starred_players(team_id);
CREATE INDEX IF NOT EXISTS idx_starred_players_player_id ON starred_players(player_id);

-- Unique constraint: One star per player per team
CREATE UNIQUE INDEX IF NOT EXISTS idx_starred_players_unique 
ON starred_players(team_id, player_id);

-- ============================================
-- 6. PLAYERS TABLE (Reference)
-- ============================================
-- Note: This table should already exist from your player import system
-- Adding status column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'players' AND column_name = 'status'
  ) THEN
    ALTER TABLE players ADD COLUMN status VARCHAR(50) DEFAULT 'available' 
    CHECK (status IN ('available', 'sold', 'unavailable'));
  END IF;
END $$;

-- Add index for player status
CREATE INDEX IF NOT EXISTS idx_players_status ON players(status);

-- ============================================
-- 7. TRIGGERS FOR UPDATED_AT
-- ============================================

-- Function to update updated_at timestamp
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

-- Trigger for bids table
DROP TRIGGER IF EXISTS update_bids_updated_at ON bids;
CREATE TRIGGER update_bids_updated_at
  BEFORE UPDATE ON bids
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for teams table
DROP TRIGGER IF EXISTS update_teams_updated_at ON teams;
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 8. VIEWS FOR CONVENIENCE
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

-- View: Team budgets and player counts
CREATE OR REPLACE VIEW team_summary AS
SELECT 
  t.id,
  t.name,
  t.budget_remaining,
  t.total_budget,
  COUNT(DISTINCT tp.player_id) as total_players,
  COALESCE(SUM(tp.purchase_price), 0) as total_spent
FROM teams t
LEFT JOIN team_players tp ON t.id = tp.team_id
GROUP BY t.id, t.name, t.budget_remaining, t.total_budget;

-- View: Player bid history
CREATE OR REPLACE VIEW player_bid_history AS
SELECT 
  p.id as player_id,
  p.name as player_name,
  p.position,
  b.id as bid_id,
  b.team_id,
  t.name as team_name,
  b.amount,
  b.status as bid_status,
  b.created_at as bid_time,
  r.id as round_id,
  r.position as round_position,
  r.status as round_status
FROM players p
LEFT JOIN bids b ON p.id = b.player_id
LEFT JOIN teams t ON b.team_id = t.id
LEFT JOIN rounds r ON b.round_id = r.id;

-- ============================================
-- 9. SAMPLE DATA (Optional - for testing)
-- ============================================

-- Uncomment the following to insert sample data for testing

/*
-- Sample team (you can add more as needed)
INSERT INTO teams (id, name, budget_remaining, total_budget)
VALUES ('team-001', 'Test Team FC', 100000, 100000)
ON CONFLICT (id) DO NOTHING;

-- Sample round (adjust season_id and end_time as needed)
INSERT INTO rounds (season_id, position, max_bids_per_team, end_time, status)
VALUES ('season-001', 'GK', 5, NOW() + INTERVAL '2 hours', 'active')
ON CONFLICT DO NOTHING;
*/

-- ============================================
-- 10. GRANTS (Adjust based on your user setup)
-- ============================================

-- Grant permissions (adjust username as needed)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_neon_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_neon_user;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Verify tables were created
SELECT 
  table_name, 
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name IN ('rounds', 'bids', 'team_players', 'teams', 'starred_players')
ORDER BY table_name;

-- Show summary
DO $$
BEGIN
  RAISE NOTICE '✅ Migration completed successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Created tables:';
  RAISE NOTICE '  1. rounds - Bidding rounds';
  RAISE NOTICE '  2. bids - Team bids on players';
  RAISE NOTICE '  3. team_players - Acquired players';
  RAISE NOTICE '  4. teams - Team information';
  RAISE NOTICE '  5. starred_players - Favorited players';
  RAISE NOTICE '';
  RAISE NOTICE 'Created views:';
  RAISE NOTICE '  1. active_rounds_with_stats';
  RAISE NOTICE '  2. team_summary';
  RAISE NOTICE '  3. player_bid_history';
  RAISE NOTICE '';
  RAISE NOTICE 'Ready for blind bidding system! 🎉';
END $$;
