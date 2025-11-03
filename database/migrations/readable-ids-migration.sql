-- ========================================
-- READABLE IDS MIGRATION FOR AUCTION SYSTEM
-- ========================================
-- This migration converts UUID-based IDs to human-readable formatted IDs
-- Format examples:
--   Rounds: SSPSLFR00001
--   Teams: SSPSLT0001
--   Bids: SSPSLT0001_SSPSLFR00001
--   Tiebreakers: SSPSLTR00001
--   Team Tiebreakers: SSPSLT0001_SSPSLTR00001
--   Bulk Rounds: SSPSLFBR00001
--   Bulk Tiebreakers: SSPSLBT00001
-- ========================================

BEGIN;

-- ========================================
-- STEP 1: Create Teams Table (if not exists)
-- ========================================
CREATE TABLE IF NOT EXISTS teams (
    id VARCHAR(50) PRIMARY KEY,  -- Format: SSPSLT0001
    name VARCHAR(255) NOT NULL,
    firebase_uid VARCHAR(255) UNIQUE,  -- Keep Firebase UID for authentication
    season_id VARCHAR(255),
    budget NUMERIC(10, 2) DEFAULT 1000000,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_firebase_uid ON teams(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_teams_season_id ON teams(season_id);

-- ========================================
-- STEP 2: Create Bulk Rounds Table (if not exists)
-- ========================================
CREATE TABLE IF NOT EXISTS bulk_rounds (
    id VARCHAR(50) PRIMARY KEY,  -- Format: SSPSLFBR00001
    season_id VARCHAR(255) NOT NULL,
    positions JSONB NOT NULL,  -- Array of positions included in this bulk round
    status VARCHAR(50) DEFAULT 'pending',
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bulk_rounds_season_id ON bulk_rounds(season_id);
CREATE INDEX IF NOT EXISTS idx_bulk_rounds_status ON bulk_rounds(status);

-- ========================================
-- STEP 3: Drop existing foreign key constraints
-- ========================================
-- Drop FK constraints that reference UUIDs
ALTER TABLE IF EXISTS bids DROP CONSTRAINT IF EXISTS bids_round_id_fkey;
ALTER TABLE IF EXISTS bids DROP CONSTRAINT IF EXISTS bids_team_id_fkey;
ALTER TABLE IF EXISTS tiebreakers DROP CONSTRAINT IF EXISTS tiebreakers_round_id_fkey;
ALTER TABLE IF EXISTS tiebreakers DROP CONSTRAINT IF EXISTS tiebreakers_winning_team_id_fkey;
ALTER TABLE IF EXISTS team_tiebreakers DROP CONSTRAINT IF EXISTS team_tiebreakers_tiebreaker_id_fkey;
ALTER TABLE IF EXISTS team_tiebreakers DROP CONSTRAINT IF EXISTS team_tiebreakers_team_id_fkey;
ALTER TABLE IF EXISTS bulk_tiebreakers DROP CONSTRAINT IF EXISTS bulk_tiebreakers_bulk_round_id_fkey;
ALTER TABLE IF EXISTS bulk_tiebreakers DROP CONSTRAINT IF EXISTS bulk_tiebreakers_winning_team_id_fkey;

-- ========================================
-- STEP 4: Modify Rounds table
-- ========================================
-- Drop and recreate rounds table with new ID format
DROP TABLE IF EXISTS rounds CASCADE;

CREATE TABLE rounds (
    id VARCHAR(50) PRIMARY KEY,  -- Format: SSPSLFR00001
    season_id VARCHAR(255) NOT NULL,
    position VARCHAR(50),
    position_group VARCHAR(50),
    round_number INTEGER,
    round_type VARCHAR(50) DEFAULT 'normal',
    max_bids_per_team INTEGER DEFAULT 5,
    base_price INTEGER DEFAULT 10,
    duration_seconds INTEGER DEFAULT 300,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rounds_season_id ON rounds(season_id);
CREATE INDEX IF NOT EXISTS idx_rounds_status ON rounds(status);
CREATE INDEX IF NOT EXISTS idx_rounds_position ON rounds(position);

-- ========================================
-- STEP 5: Modify Bids table
-- ========================================
-- Drop and recreate bids table with new ID format
DROP TABLE IF EXISTS bids CASCADE;

CREATE TABLE bids (
    id VARCHAR(100) PRIMARY KEY,  -- Format: SSPSLT0001_SSPSLFR00001
    round_id VARCHAR(50) NOT NULL,
    team_id VARCHAR(50) NOT NULL,
    team_name VARCHAR(255),
    player_id VARCHAR(255) NOT NULL,
    amount NUMERIC(10, 2),
    encrypted_amount TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    phase VARCHAR(50) DEFAULT 'open',
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bids_round_id ON bids(round_id);
CREATE INDEX IF NOT EXISTS idx_bids_team_id ON bids(team_id);
CREATE INDEX IF NOT EXISTS idx_bids_player_id ON bids(player_id);
CREATE INDEX IF NOT EXISTS idx_bids_status ON bids(status);

-- ========================================
-- STEP 6: Modify Tiebreakers table
-- ========================================
-- Drop and recreate tiebreakers table with new ID format
DROP TABLE IF EXISTS tiebreakers CASCADE;

CREATE TABLE tiebreakers (
    id VARCHAR(50) PRIMARY KEY,  -- Format: SSPSLTR00001
    round_id VARCHAR(50),
    season_id VARCHAR(255),
    player_id VARCHAR(255) NOT NULL,
    player_name VARCHAR(255),
    original_amount NUMERIC(10, 2),
    tied_teams JSONB NOT NULL,  -- Array of team IDs and names
    status VARCHAR(50) DEFAULT 'active',
    duration_minutes INTEGER,  -- NULL means no time limit
    winning_team_id VARCHAR(50),
    winning_amount NUMERIC(10, 2),
    winning_bid NUMERIC(10, 2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE,
    FOREIGN KEY (winning_team_id) REFERENCES teams(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tiebreakers_round_id ON tiebreakers(round_id);
CREATE INDEX IF NOT EXISTS idx_tiebreakers_season_id ON tiebreakers(season_id);
CREATE INDEX IF NOT EXISTS idx_tiebreakers_player_id ON tiebreakers(player_id);
CREATE INDEX IF NOT EXISTS idx_tiebreakers_status ON tiebreakers(status);

-- ========================================
-- STEP 7: Modify Team Tiebreakers table
-- ========================================
-- Drop and recreate team_tiebreakers table with new ID format
DROP TABLE IF EXISTS team_tiebreakers CASCADE;

CREATE TABLE team_tiebreakers (
    id VARCHAR(100) PRIMARY KEY,  -- Format: SSPSLT0001_SSPSLTR00001
    tiebreaker_id VARCHAR(50) NOT NULL,
    team_id VARCHAR(50) NOT NULL,
    team_name VARCHAR(255),
    bid_amount NUMERIC(10, 2),
    old_bid_amount NUMERIC(10, 2) DEFAULT 0,
    new_bid_amount NUMERIC(10, 2) DEFAULT 0,
    encrypted_amount TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    submitted BOOLEAN DEFAULT false,
    submitted_at TIMESTAMPTZ,
    original_bid_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (tiebreaker_id) REFERENCES tiebreakers(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_team_tiebreakers_tiebreaker_id ON team_tiebreakers(tiebreaker_id);
CREATE INDEX IF NOT EXISTS idx_team_tiebreakers_team_id ON team_tiebreakers(team_id);

-- ========================================
-- STEP 8: Modify Bulk Tiebreakers table
-- ========================================
-- Drop and recreate bulk_tiebreakers table with new ID format
DROP TABLE IF EXISTS bulk_tiebreakers CASCADE;

CREATE TABLE bulk_tiebreakers (
    id VARCHAR(50) PRIMARY KEY,  -- Format: SSPSLBT00001
    bulk_round_id VARCHAR(50),
    season_id VARCHAR(255),
    player_id VARCHAR(255) NOT NULL,
    player_name VARCHAR(255),
    original_amount NUMERIC(10, 2),
    tied_teams JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    duration_minutes INTEGER,  -- NULL means no time limit
    winning_team_id VARCHAR(50),
    winning_amount NUMERIC(10, 2),
    winning_bid NUMERIC(10, 2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    FOREIGN KEY (bulk_round_id) REFERENCES bulk_rounds(id) ON DELETE CASCADE,
    FOREIGN KEY (winning_team_id) REFERENCES teams(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_bulk_tiebreakers_bulk_round_id ON bulk_tiebreakers(bulk_round_id);
CREATE INDEX IF NOT EXISTS idx_bulk_tiebreakers_season_id ON bulk_tiebreakers(season_id);
CREATE INDEX IF NOT EXISTS idx_bulk_tiebreakers_player_id ON bulk_tiebreakers(player_id);
CREATE INDEX IF NOT EXISTS idx_bulk_tiebreakers_status ON bulk_tiebreakers(status);

COMMIT;

-- ========================================
-- MIGRATION COMPLETE
-- ========================================
-- All tables now use readable IDs:
-- - Rounds: SSPSLFR00001
-- - Teams: SSPSLT0001  
-- - Bids: SSPSLT0001_SSPSLFR00001
-- - Tiebreakers: SSPSLTR00001
-- - Team Tiebreakers: SSPSLT0001_SSPSLTR00001
-- - Bulk Rounds: SSPSLFBR00001
-- - Bulk Tiebreakers: SSPSLBT00001
-- ========================================
