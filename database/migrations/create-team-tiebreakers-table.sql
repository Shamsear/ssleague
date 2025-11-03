-- Create team_tiebreakers table for individual team bids in tiebreaker rounds
CREATE TABLE IF NOT EXISTS team_tiebreakers (
    id SERIAL PRIMARY KEY,
    tiebreaker_id INTEGER NOT NULL REFERENCES tiebreakers(id) ON DELETE CASCADE,
    team_id VARCHAR(255) NOT NULL,
    team_name VARCHAR(255),
    old_bid_amount INTEGER NOT NULL,
    new_bid_amount INTEGER,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_team_tiebreakers_tiebreaker_id ON team_tiebreakers(tiebreaker_id);
CREATE INDEX IF NOT EXISTS idx_team_tiebreakers_team_id ON team_tiebreakers(team_id);
CREATE INDEX IF NOT EXISTS idx_team_tiebreakers_status ON team_tiebreakers(status);

-- Add comment
COMMENT ON TABLE team_tiebreakers IS 'Individual team bids within a tiebreaker round';
