-- Player History Table
-- Tracks complete ownership and contract history for every player
-- Records created on: auction win, transfer, swap, release, team takeover

CREATE TABLE IF NOT EXISTS player_history (
    id SERIAL PRIMARY KEY,
    
    -- Player Info
    player_id VARCHAR(255) NOT NULL,  -- References footballplayers.player_id
    player_name VARCHAR(255) NOT NULL,
    position VARCHAR(50),
    
    -- Ownership Info
    team_id VARCHAR(255) NOT NULL,
    team_name VARCHAR(255) NOT NULL,
    season_id VARCHAR(255) NOT NULL,
    
    -- Contract Details
    acquisition_type VARCHAR(50) NOT NULL,  -- 'auction', 'transfer', 'swap', 'takeover', 'carryover'
    acquisition_value INTEGER,
    acquisition_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Status
    status VARCHAR(50) DEFAULT 'active',  -- 'active', 'released', 'transferred', 'swapped'
    end_date TIMESTAMP,
    end_reason VARCHAR(50),  -- 'release', 'transfer', 'swap', 'season_end', 'takeover'
    
    -- Related Records
    round_id VARCHAR(255),  -- If acquired via auction
    transaction_id VARCHAR(255),  -- If there's a related transaction
    related_history_id INTEGER,  -- Links to the history record this replaced (for swaps/transfers)
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    CONSTRAINT fk_related_history FOREIGN KEY (related_history_id) REFERENCES player_history(id)
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_player_history_player_id ON player_history(player_id);
CREATE INDEX IF NOT EXISTS idx_player_history_team_id ON player_history(team_id);
CREATE INDEX IF NOT EXISTS idx_player_history_season_id ON player_history(season_id);
CREATE INDEX IF NOT EXISTS idx_player_history_status ON player_history(status);
CREATE INDEX IF NOT EXISTS idx_player_history_player_team_season ON player_history(player_id, team_id, season_id);

-- Comments
COMMENT ON TABLE player_history IS 'Complete ownership and contract history for all players across all seasons';
COMMENT ON COLUMN player_history.acquisition_type IS 'How the player was acquired: auction, transfer, swap, takeover, carryover';
COMMENT ON COLUMN player_history.status IS 'Current status: active (currently owned), released, transferred, swapped';
COMMENT ON COLUMN player_history.end_reason IS 'Why the ownership ended: release, transfer, swap, season_end, takeover';
COMMENT ON COLUMN player_history.related_history_id IS 'Links to previous history record (useful for tracking swap chains)';
