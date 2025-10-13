-- Migration: Create starred_players table for team-specific starred players
-- This allows each team to maintain their own list of starred players

-- Create the starred_players junction table
CREATE TABLE IF NOT EXISTS starred_players (
  id SERIAL PRIMARY KEY,
  team_id VARCHAR(255) NOT NULL,  -- Firebase Auth UID of the team
  player_id VARCHAR(255) NOT NULL REFERENCES footballplayers(id) ON DELETE CASCADE,
  starred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(team_id, player_id)  -- Ensure a team can only star a player once
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_starred_players_team_id ON starred_players(team_id);
CREATE INDEX IF NOT EXISTS idx_starred_players_player_id ON starred_players(player_id);
CREATE INDEX IF NOT EXISTS idx_starred_players_team_player ON starred_players(team_id, player_id);

-- Optional: Remove the old is_starred column from footballplayers table
-- Uncomment the line below if you want to remove the old column
-- ALTER TABLE footballplayers DROP COLUMN IF EXISTS is_starred;

-- Comments for documentation
COMMENT ON TABLE starred_players IS 'Junction table linking teams to their starred players';
COMMENT ON COLUMN starred_players.team_id IS 'Firebase Auth UID of the team that starred the player';
COMMENT ON COLUMN starred_players.player_id IS 'ID of the player that was starred';
COMMENT ON COLUMN starred_players.starred_at IS 'Timestamp when the player was starred';
