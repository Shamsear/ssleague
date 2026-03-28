-- Fantasy League Revamp - Phase 3: Transfer & Trading System
-- Migration: Create transfer and trade tables
-- Date: 2026-02-26

-- ============================================================================
-- CREATE fantasy_releases TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS fantasy_releases (
  id SERIAL PRIMARY KEY,
  release_id VARCHAR(100) UNIQUE NOT NULL,
  league_id VARCHAR(100) NOT NULL,
  team_id VARCHAR(100) NOT NULL,
  real_player_id VARCHAR(100) NOT NULL,
  
  -- Financial details
  purchase_price DECIMAL(10,2) NOT NULL,
  refund_amount DECIMAL(10,2) NOT NULL,
  refund_percentage DECIMAL(5,2) DEFAULT 80.00,
  
  -- Timing
  released_at TIMESTAMP DEFAULT NOW(),
  transfer_window_id VARCHAR(100),
  
  -- Status
  status VARCHAR(20) DEFAULT 'completed',
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT fk_release_team FOREIGN KEY (team_id) 
    REFERENCES fantasy_teams(team_id) ON DELETE CASCADE,
  CONSTRAINT check_refund_positive CHECK (refund_amount >= 0),
  CONSTRAINT check_purchase_positive CHECK (purchase_price >= 0)
);

-- ============================================================================
-- CREATE fantasy_trades TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS fantasy_trades (
  id SERIAL PRIMARY KEY,
  trade_id VARCHAR(100) UNIQUE NOT NULL,
  league_id VARCHAR(100) NOT NULL,
  
  -- Teams involved
  team_a_id VARCHAR(100) NOT NULL,
  team_b_id VARCHAR(100) NOT NULL,
  
  -- Trade type
  trade_type VARCHAR(20) NOT NULL, -- 'sale', 'swap'
  
  -- Players involved (JSONB arrays of player IDs)
  team_a_players JSONB NOT NULL DEFAULT '[]'::jsonb,
  team_b_players JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Cash involved
  team_a_cash DECIMAL(10,2) DEFAULT 0,
  team_b_cash DECIMAL(10,2) DEFAULT 0,
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'expired', 'cancelled'
  
  -- Timing
  proposed_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  responded_at TIMESTAMP,
  
  -- Response
  response_message TEXT,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT fk_trade_team_a FOREIGN KEY (team_a_id) 
    REFERENCES fantasy_teams(team_id) ON DELETE CASCADE,
  CONSTRAINT fk_trade_team_b FOREIGN KEY (team_b_id) 
    REFERENCES fantasy_teams(team_id) ON DELETE CASCADE,
  CONSTRAINT check_different_teams CHECK (team_a_id != team_b_id),
  CONSTRAINT check_valid_trade_type CHECK (trade_type IN ('sale', 'swap')),
  CONSTRAINT check_valid_status CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled'))
);

-- ============================================================================
-- CREATE fantasy_transfer_windows TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS fantasy_transfer_windows (
  id SERIAL PRIMARY KEY,
  window_id VARCHAR(100) UNIQUE NOT NULL,
  league_id VARCHAR(100) NOT NULL,
  
  -- Window type
  window_type VARCHAR(20) NOT NULL, -- 'release', 'draft', 'trading'
  
  -- Timing
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  
  -- Status
  status VARCHAR(20) DEFAULT 'scheduled', -- 'scheduled', 'active', 'closed'
  
  -- Configuration
  config JSONB DEFAULT '{}'::jsonb,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT check_valid_window_type CHECK (window_type IN ('release', 'draft', 'trading')),
  CONSTRAINT check_valid_window_status CHECK (status IN ('scheduled', 'active', 'closed')),
  CONSTRAINT check_end_after_start CHECK (end_time > start_time)
);

-- ============================================================================
-- CREATE INDEXES
-- ============================================================================

-- Releases indexes
CREATE INDEX IF NOT EXISTS idx_fantasy_releases_team 
ON fantasy_releases(team_id);

CREATE INDEX IF NOT EXISTS idx_fantasy_releases_player 
ON fantasy_releases(real_player_id);

CREATE INDEX IF NOT EXISTS idx_fantasy_releases_league 
ON fantasy_releases(league_id);

CREATE INDEX IF NOT EXISTS idx_fantasy_releases_window 
ON fantasy_releases(transfer_window_id);

CREATE INDEX IF NOT EXISTS idx_fantasy_releases_released_at 
ON fantasy_releases(released_at DESC);

-- Trades indexes
CREATE INDEX IF NOT EXISTS idx_fantasy_trades_team_a 
ON fantasy_trades(team_a_id);

CREATE INDEX IF NOT EXISTS idx_fantasy_trades_team_b 
ON fantasy_trades(team_b_id);

CREATE INDEX IF NOT EXISTS idx_fantasy_trades_league 
ON fantasy_trades(league_id);

CREATE INDEX IF NOT EXISTS idx_fantasy_trades_status 
ON fantasy_trades(status);

CREATE INDEX IF NOT EXISTS idx_fantasy_trades_expires 
ON fantasy_trades(expires_at) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_fantasy_trades_proposed_at 
ON fantasy_trades(proposed_at DESC);

-- Composite indexes for trades
CREATE INDEX IF NOT EXISTS idx_fantasy_trades_team_a_status 
ON fantasy_trades(team_a_id, status);

CREATE INDEX IF NOT EXISTS idx_fantasy_trades_team_b_status 
ON fantasy_trades(team_b_id, status);

-- Transfer windows indexes
CREATE INDEX IF NOT EXISTS idx_fantasy_transfer_windows_league 
ON fantasy_transfer_windows(league_id);

CREATE INDEX IF NOT EXISTS idx_fantasy_transfer_windows_status 
ON fantasy_transfer_windows(status);

CREATE INDEX IF NOT EXISTS idx_fantasy_transfer_windows_type 
ON fantasy_transfer_windows(window_type);

CREATE INDEX IF NOT EXISTS idx_fantasy_transfer_windows_times 
ON fantasy_transfer_windows(start_time, end_time);

-- ============================================================================
-- ADD COMMENTS
-- ============================================================================

COMMENT ON TABLE fantasy_releases IS 'Player releases during transfer windows';
COMMENT ON COLUMN fantasy_releases.release_id IS 'Unique identifier for the release';
COMMENT ON COLUMN fantasy_releases.refund_amount IS 'Amount refunded to team (typically 80% of purchase price)';
COMMENT ON COLUMN fantasy_releases.refund_percentage IS 'Percentage of purchase price refunded';

COMMENT ON TABLE fantasy_trades IS 'Trade proposals between teams';
COMMENT ON COLUMN fantasy_trades.trade_id IS 'Unique identifier for the trade';
COMMENT ON COLUMN fantasy_trades.trade_type IS 'Type of trade: sale (cash only) or swap (players + optional cash)';
COMMENT ON COLUMN fantasy_trades.team_a_players IS 'JSONB array of player IDs from team A';
COMMENT ON COLUMN fantasy_trades.team_b_players IS 'JSONB array of player IDs from team B';
COMMENT ON COLUMN fantasy_trades.expires_at IS 'Trade proposal expiry time';

COMMENT ON TABLE fantasy_transfer_windows IS 'Transfer window schedules and configuration';
COMMENT ON COLUMN fantasy_transfer_windows.window_type IS 'Type: release (48h), draft (48h), or trading (ongoing)';
COMMENT ON COLUMN fantasy_transfer_windows.config IS 'JSONB configuration for window-specific settings';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('fantasy_releases', 'fantasy_trades', 'fantasy_transfer_windows')
ORDER BY table_name;

-- Verify indexes were created
SELECT 
  tablename, 
  indexname
FROM pg_indexes
WHERE tablename IN ('fantasy_releases', 'fantasy_trades', 'fantasy_transfer_windows')
ORDER BY tablename, indexname;

-- ============================================================================
-- SAMPLE DATA (for testing)
-- ============================================================================

-- Example transfer window
/*
INSERT INTO fantasy_transfer_windows (
  window_id,
  league_id,
  window_type,
  start_time,
  end_time,
  status
) VALUES (
  'window_release_2024_01',
  'league_1',
  'release',
  NOW(),
  NOW() + INTERVAL '48 hours',
  'active'
);
*/

-- ============================================================================
-- ROLLBACK SCRIPT (save separately as fantasy_revamp_transfer_tables_rollback.sql)
-- ============================================================================

/*
-- To rollback this migration, run:

-- Drop indexes
DROP INDEX IF EXISTS idx_fantasy_transfer_windows_times;
DROP INDEX IF EXISTS idx_fantasy_transfer_windows_type;
DROP INDEX IF EXISTS idx_fantasy_transfer_windows_status;
DROP INDEX IF EXISTS idx_fantasy_transfer_windows_league;
DROP INDEX IF EXISTS idx_fantasy_trades_team_b_status;
DROP INDEX IF EXISTS idx_fantasy_trades_team_a_status;
DROP INDEX IF EXISTS idx_fantasy_trades_proposed_at;
DROP INDEX IF EXISTS idx_fantasy_trades_expires;
DROP INDEX IF EXISTS idx_fantasy_trades_status;
DROP INDEX IF EXISTS idx_fantasy_trades_league;
DROP INDEX IF EXISTS idx_fantasy_trades_team_b;
DROP INDEX IF EXISTS idx_fantasy_trades_team_a;
DROP INDEX IF EXISTS idx_fantasy_releases_released_at;
DROP INDEX IF EXISTS idx_fantasy_releases_window;
DROP INDEX IF EXISTS idx_fantasy_releases_league;
DROP INDEX IF EXISTS idx_fantasy_releases_player;
DROP INDEX IF EXISTS idx_fantasy_releases_team;

-- Drop tables
DROP TABLE IF EXISTS fantasy_transfer_windows;
DROP TABLE IF EXISTS fantasy_trades;
DROP TABLE IF EXISTS fantasy_releases;
*/
