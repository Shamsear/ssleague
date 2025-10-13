-- Auction Rounds Table
CREATE TABLE IF NOT EXISTS auction_rounds (
    id SERIAL PRIMARY KEY,
    season_id VARCHAR(255) NOT NULL,
    round_number INTEGER NOT NULL,
    position VARCHAR(50),
    position_group VARCHAR(10),
    status VARCHAR(20) DEFAULT 'draft',
    round_type VARCHAR(20) DEFAULT 'normal',
    base_price INTEGER DEFAULT 10,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    duration_seconds INTEGER DEFAULT 300,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(season_id, round_number)
);

-- Round Players Table (Players assigned to a specific round)
CREATE TABLE IF NOT EXISTS round_players (
    id SERIAL PRIMARY KEY,
    round_id INTEGER REFERENCES auction_rounds(id) ON DELETE CASCADE,
    player_id VARCHAR(255) NOT NULL,
    player_name VARCHAR(255),
    position VARCHAR(50),
    position_group VARCHAR(10),
    base_price INTEGER,
    status VARCHAR(20) DEFAULT 'pending',
    winning_team_id VARCHAR(255),
    winning_bid INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(round_id, player_id)
);

-- Round Bids Table (Track all bids during a round)
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_auction_rounds_season ON auction_rounds(season_id);
CREATE INDEX IF NOT EXISTS idx_auction_rounds_status ON auction_rounds(status);
CREATE INDEX IF NOT EXISTS idx_round_players_round ON round_players(round_id);
CREATE INDEX IF NOT EXISTS idx_round_players_player ON round_players(player_id);
CREATE INDEX IF NOT EXISTS idx_round_bids_round ON round_bids(round_id);
CREATE INDEX IF NOT EXISTS idx_round_bids_player ON round_bids(player_id);
CREATE INDEX IF NOT EXISTS idx_round_bids_team ON round_bids(team_id);

-- Trigger to update updated_at timestamp for auction_rounds
CREATE OR REPLACE FUNCTION update_auction_rounds_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_auction_rounds_updated_at 
    BEFORE UPDATE ON auction_rounds
    FOR EACH ROW
    EXECUTE FUNCTION update_auction_rounds_updated_at();

-- Comments for documentation
COMMENT ON TABLE auction_rounds IS 'Main auction rounds table';
COMMENT ON TABLE round_players IS 'Players assigned to each auction round';
COMMENT ON TABLE round_bids IS 'All bids placed during rounds';
COMMENT ON COLUMN auction_rounds.status IS 'draft, scheduled, active, completed, cancelled';
COMMENT ON COLUMN auction_rounds.round_type IS 'normal, bulk, tiebreaker';
