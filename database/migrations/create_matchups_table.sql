-- Create matchups table
CREATE TABLE IF NOT EXISTS matchups (
  id SERIAL PRIMARY KEY,
  fixture_id TEXT NOT NULL,
  home_player_id TEXT NOT NULL,
  home_player_name TEXT NOT NULL,
  away_player_id TEXT NOT NULL,
  away_player_name TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(fixture_id, position)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_matchups_fixture_id ON matchups(fixture_id);
CREATE INDEX IF NOT EXISTS idx_matchups_created_by ON matchups(created_by);
