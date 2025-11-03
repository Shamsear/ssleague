-- Create team_players table to track which players are on which team
-- This is populated when rounds are finalized

CREATE TABLE IF NOT EXISTS team_players (
    id SERIAL PRIMARY KEY,
    team_id VARCHAR(255) NOT NULL,
    player_id VARCHAR(255) NOT NULL,
    season_id VARCHAR(255) NOT NULL,
    round_id VARCHAR(255),
    purchase_price INTEGER NOT NULL,
    acquired_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent duplicate player assignments
    UNIQUE(player_id, season_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_team_players_team_id ON team_players(team_id);
CREATE INDEX IF NOT EXISTS idx_team_players_player_id ON team_players(player_id);
CREATE INDEX IF NOT EXISTS idx_team_players_season_id ON team_players(season_id);
CREATE INDEX IF NOT EXISTS idx_team_players_round_id ON team_players(round_id);

-- Add comments
COMMENT ON TABLE team_players IS 'Tracks which players are on which team after auction finalization';
COMMENT ON COLUMN team_players.team_id IS 'Team that owns this player';
COMMENT ON COLUMN team_players.player_id IS 'Player ID from footballplayers table';
COMMENT ON COLUMN team_players.season_id IS 'Season this assignment belongs to';
COMMENT ON COLUMN team_players.purchase_price IS 'Amount team paid for this player';
