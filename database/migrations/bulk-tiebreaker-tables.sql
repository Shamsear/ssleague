-- ============================================================================
-- Bulk Bidding Tiebreaker Tables - Last Person Standing Mechanism
-- Created: 2025-10-09
-- ============================================================================

-- Drop existing tables if they exist (for clean migration)
DROP TABLE IF EXISTS bulk_tiebreaker_bids CASCADE;
DROP TABLE IF EXISTS bulk_tiebreaker_teams CASCADE;
DROP TABLE IF EXISTS bulk_tiebreakers CASCADE;

-- ============================================================================
-- Table: bulk_tiebreakers
-- Purpose: Main tiebreaker table for players with multiple bids in bulk rounds
-- ============================================================================
CREATE TABLE bulk_tiebreakers (
    id SERIAL PRIMARY KEY,
    round_id INTEGER NOT NULL,
    player_id VARCHAR(255) NOT NULL,
    player_name VARCHAR(255) NOT NULL,
    position VARCHAR(50),
    base_price INTEGER DEFAULT 10,
    
    -- Status: pending, active, resolved, cancelled
    status VARCHAR(20) DEFAULT 'pending',
    
    -- Current auction state
    current_highest_bid INTEGER DEFAULT 10,
    current_highest_team_id VARCHAR(255),
    teams_remaining INTEGER DEFAULT 0,
    
    -- Timing (no fixed timer, runs until 1 team left)
    start_time TIMESTAMP,
    last_activity_time TIMESTAMP,
    max_end_time TIMESTAMP, -- start_time + 24 hours (safety limit)
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(round_id, player_id)
);

-- ============================================================================
-- Table: bulk_tiebreaker_teams
-- Purpose: Track which teams are participating in each tiebreaker
-- ============================================================================
CREATE TABLE bulk_tiebreaker_teams (
    id SERIAL PRIMARY KEY,
    tiebreaker_id INTEGER NOT NULL REFERENCES bulk_tiebreakers(id) ON DELETE CASCADE,
    team_id VARCHAR(255) NOT NULL,
    team_name VARCHAR(255),
    
    -- Status: active, withdrawn
    status VARCHAR(20) DEFAULT 'active',
    
    -- Current bid from this team
    current_bid INTEGER DEFAULT 10,
    
    -- Timestamps
    joined_at TIMESTAMP DEFAULT NOW(),
    withdrawn_at TIMESTAMP,
    
    -- Constraints
    UNIQUE(tiebreaker_id, team_id)
);

-- ============================================================================
-- Table: bulk_tiebreaker_bids
-- Purpose: History of all bids placed during the tiebreaker auction
-- ============================================================================
CREATE TABLE bulk_tiebreaker_bids (
    id SERIAL PRIMARY KEY,
    tiebreaker_id INTEGER NOT NULL REFERENCES bulk_tiebreakers(id) ON DELETE CASCADE,
    team_id VARCHAR(255) NOT NULL,
    team_name VARCHAR(255),
    bid_amount INTEGER NOT NULL,
    bid_time TIMESTAMP DEFAULT NOW(),
    
    -- Index for faster queries
    INDEX idx_tiebreaker_time (tiebreaker_id, bid_time DESC)
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Bulk Tiebreakers
CREATE INDEX idx_bulk_tiebreakers_round ON bulk_tiebreakers(round_id);
CREATE INDEX idx_bulk_tiebreakers_status ON bulk_tiebreakers(status);
CREATE INDEX idx_bulk_tiebreakers_activity ON bulk_tiebreakers(last_activity_time) WHERE status = 'active';
CREATE INDEX idx_bulk_tiebreakers_max_end ON bulk_tiebreakers(max_end_time) WHERE status = 'active';

-- Bulk Tiebreaker Teams
CREATE INDEX idx_bulk_tiebreaker_teams_tiebreaker ON bulk_tiebreaker_teams(tiebreaker_id);
CREATE INDEX idx_bulk_tiebreaker_teams_team ON bulk_tiebreaker_teams(team_id);
CREATE INDEX idx_bulk_tiebreaker_teams_status ON bulk_tiebreaker_teams(tiebreaker_id, status);

-- Bulk Tiebreaker Bids
CREATE INDEX idx_bulk_tiebreaker_bids_tiebreaker ON bulk_tiebreaker_bids(tiebreaker_id);
CREATE INDEX idx_bulk_tiebreaker_bids_team ON bulk_tiebreaker_bids(team_id);

-- ============================================================================
-- Triggers
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_bulk_tiebreaker_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_bulk_tiebreakers_timestamp
    BEFORE UPDATE ON bulk_tiebreakers
    FOR EACH ROW
    EXECUTE FUNCTION update_bulk_tiebreaker_timestamp();

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to check if only 1 team remains (auto-finalize condition)
CREATE OR REPLACE FUNCTION check_tiebreaker_winner(tiebreaker_id_param INTEGER)
RETURNS TABLE(
    teams_left INTEGER,
    winner_team_id VARCHAR(255),
    winner_bid INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as teams_left,
        MAX(CASE WHEN status = 'active' THEN team_id END)::VARCHAR(255) as winner_team_id,
        MAX(CASE WHEN status = 'active' THEN current_bid END)::INTEGER as winner_bid
    FROM bulk_tiebreaker_teams
    WHERE tiebreaker_id = tiebreaker_id_param
    AND status = 'active';
END;
$$ LANGUAGE plpgsql;

-- Function to get tiebreaker stats for admin dashboard
CREATE OR REPLACE FUNCTION get_tiebreaker_stats()
RETURNS TABLE(
    total_active INTEGER,
    total_pending INTEGER,
    stalled_count INTEGER,
    overdue_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) FILTER (WHERE status = 'active')::INTEGER as total_active,
        COUNT(*) FILTER (WHERE status = 'pending')::INTEGER as total_pending,
        COUNT(*) FILTER (
            WHERE status = 'active' 
            AND last_activity_time < NOW() - INTERVAL '3 hours'
        )::INTEGER as stalled_count,
        COUNT(*) FILTER (
            WHERE status = 'active' 
            AND max_end_time < NOW()
        )::INTEGER as overdue_count
    FROM bulk_tiebreakers;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON TABLE bulk_tiebreakers IS 'Main tiebreaker table for Last Person Standing auction mechanism';
COMMENT ON TABLE bulk_tiebreaker_teams IS 'Tracks team participation and withdrawal status in tiebreakers';
COMMENT ON TABLE bulk_tiebreaker_bids IS 'Complete bid history for audit trail and analytics';

COMMENT ON COLUMN bulk_tiebreakers.status IS 'pending: not started | active: auction running | resolved: winner assigned | cancelled: manually cancelled';
COMMENT ON COLUMN bulk_tiebreakers.teams_remaining IS 'Count of active (non-withdrawn) teams - auto-finalize when = 1';
COMMENT ON COLUMN bulk_tiebreakers.last_activity_time IS 'Last bid or withdrawal time - used for 3-hour inactivity check';
COMMENT ON COLUMN bulk_tiebreakers.max_end_time IS 'Safety limit: start_time + 24 hours - admin must force-finalize after this';

COMMENT ON COLUMN bulk_tiebreaker_teams.status IS 'active: can bid/withdraw | withdrawn: permanently out';
COMMENT ON COLUMN bulk_tiebreaker_teams.current_bid IS 'Teams last/current bid amount in this tiebreaker';

-- ============================================================================
-- Sample Data for Testing (Comment out in production)
-- ============================================================================

/*
-- Example: Create a test tiebreaker
INSERT INTO bulk_tiebreakers (
    round_id, player_id, player_name, position, 
    status, teams_remaining, start_time, last_activity_time, max_end_time
) VALUES (
    1, 'player_123', 'John Doe', 'CF',
    'active', 3, NOW(), NOW(), NOW() + INTERVAL '24 hours'
);

-- Example: Add teams to tiebreaker
INSERT INTO bulk_tiebreaker_teams (tiebreaker_id, team_id, team_name, status, current_bid) VALUES
    (1, 'team_a', 'Team Alpha', 'active', 10),
    (1, 'team_b', 'Team Beta', 'active', 10),
    (1, 'team_c', 'Team Gamma', 'active', 10);

-- Example: Add some bids
INSERT INTO bulk_tiebreaker_bids (tiebreaker_id, team_id, team_name, bid_amount) VALUES
    (1, 'team_a', 'Team Alpha', 20),
    (1, 'team_b', 'Team Beta', 25);

-- Example: Team withdraws
UPDATE bulk_tiebreaker_teams 
SET status = 'withdrawn', withdrawn_at = NOW()
WHERE tiebreaker_id = 1 AND team_id = 'team_c';

-- Example: Check winner
SELECT * FROM check_tiebreaker_winner(1);

-- Example: Get dashboard stats
SELECT * FROM get_tiebreaker_stats();
*/

-- ============================================================================
-- Migration Complete
-- ============================================================================

COMMENT ON SCHEMA public IS 'Bulk tiebreaker tables created successfully';

-- Print success message
DO $$
BEGIN
    RAISE NOTICE '✅ Bulk tiebreaker tables created successfully!';
    RAISE NOTICE 'Tables: bulk_tiebreakers, bulk_tiebreaker_teams, bulk_tiebreaker_bids';
    RAISE NOTICE 'Helper functions: check_tiebreaker_winner(), get_tiebreaker_stats()';
END $$;
