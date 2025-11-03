-- Step 1: Check if starred_players table exists and view its structure
SELECT 
    table_name,
    column_name, 
    data_type,
    character_maximum_length,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'starred_players'
ORDER BY ordinal_position;

-- If the above query returns no rows, the table doesn't exist
-- If it returns rows but missing 'team_id' column, the table structure is wrong

-- Step 2: Create the table if it doesn't exist (safe - won't drop existing data)
CREATE TABLE IF NOT EXISTS starred_players (
  id SERIAL PRIMARY KEY,
  team_id VARCHAR(255) NOT NULL,  -- Firebase Auth UID of the team
  player_id VARCHAR(255) NOT NULL REFERENCES footballplayers(id) ON DELETE CASCADE,
  starred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(team_id, player_id)  -- Ensure a team can only star a player once
);

-- Step 3: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_starred_players_team_id ON starred_players(team_id);
CREATE INDEX IF NOT EXISTS idx_starred_players_player_id ON starred_players(player_id);
CREATE INDEX IF NOT EXISTS idx_starred_players_team_player ON starred_players(team_id, player_id);

-- Step 4: Add comments for documentation
COMMENT ON TABLE starred_players IS 'Junction table linking teams to their starred players';
COMMENT ON COLUMN starred_players.team_id IS 'Firebase Auth UID of the team that starred the player';
COMMENT ON COLUMN starred_players.player_id IS 'VARCHAR ID of the player that was starred (matches footballplayers.id)';
COMMENT ON COLUMN starred_players.starred_at IS 'Timestamp when the player was starred';

-- Step 5: Verify the table was created correctly
SELECT 
    column_name, 
    data_type,
    character_maximum_length,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'starred_players'
ORDER BY ordinal_position;

-- Step 6: Check if there's any data in the table
SELECT COUNT(*) as row_count FROM starred_players;
