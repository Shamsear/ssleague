-- Fix script: Drop and recreate starred_players table with correct data types
-- Use this if you already tried to create the table with wrong data type

-- Drop the table if it exists (this will remove any existing data)
DROP TABLE IF EXISTS starred_players CASCADE;

-- Create the starred_players junction table with correct data types
CREATE TABLE starred_players (
  id SERIAL PRIMARY KEY,
  team_id VARCHAR(255) NOT NULL,  -- Firebase Auth UID of the team
  player_id VARCHAR(255) NOT NULL REFERENCES footballplayers(id) ON DELETE CASCADE,
  starred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(team_id, player_id)  -- Ensure a team can only star a player once
);

-- Create indexes for better query performance
CREATE INDEX idx_starred_players_team_id ON starred_players(team_id);
CREATE INDEX idx_starred_players_player_id ON starred_players(player_id);
CREATE INDEX idx_starred_players_team_player ON starred_players(team_id, player_id);

-- Comments for documentation
COMMENT ON TABLE starred_players IS 'Junction table linking teams to their starred players';
COMMENT ON COLUMN starred_players.team_id IS 'Firebase Auth UID of the team that starred the player';
COMMENT ON COLUMN starred_players.player_id IS 'VARCHAR ID of the player that was starred (matches footballplayers.id)';
COMMENT ON COLUMN starred_players.starred_at IS 'Timestamp when the player was starred';

-- Verify the table was created correctly
SELECT 
    column_name, 
    data_type,
    character_maximum_length,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'starred_players'
ORDER BY ordinal_position;
