-- Create teamfootballplayer table for player assignments after auction finalization

CREATE TABLE IF NOT EXISTS teamfootballplayer (
  id SERIAL PRIMARY KEY,
  team_id VARCHAR(255) NOT NULL,
  player_id VARCHAR(255) NOT NULL REFERENCES footballplayers(id) ON DELETE CASCADE,
  season_id VARCHAR(255) NOT NULL,
  acquisition_type VARCHAR(50) DEFAULT 'auction', -- 'auction', 'transfer', etc.
  acquisition_price INTEGER NOT NULL DEFAULT 0,
  acquisition_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  contract_years INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(team_id, player_id, season_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_teamfootballplayer_team_id ON teamfootballplayer(team_id);
CREATE INDEX IF NOT EXISTS idx_teamfootballplayer_player_id ON teamfootballplayer(player_id);
CREATE INDEX IF NOT EXISTS idx_teamfootballplayer_season_id ON teamfootballplayer(season_id);
CREATE INDEX IF NOT EXISTS idx_teamfootballplayer_team_season ON teamfootballplayer(team_id, season_id);

-- Add comments for documentation
COMMENT ON TABLE teamfootballplayer IS 'Records of players assigned to teams after auction or transfers';
COMMENT ON COLUMN teamfootballplayer.team_id IS 'Firebase UID of the team that owns the player';
COMMENT ON COLUMN teamfootballplayer.player_id IS 'ID of the player assigned to the team';
COMMENT ON COLUMN teamfootballplayer.season_id IS 'Season in which the player was acquired';
COMMENT ON COLUMN teamfootballplayer.acquisition_type IS 'How the player was acquired (auction, transfer, etc)';
COMMENT ON COLUMN teamfootballplayer.acquisition_price IS 'Amount paid for the player';

-- Verify the table was created
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'teamfootballplayer'
ORDER BY ordinal_position;
