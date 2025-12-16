-- Create fantasy_team_bonus_points table to track passive team bonuses
CREATE TABLE IF NOT EXISTS fantasy_team_bonus_points (
  id SERIAL PRIMARY KEY,
  league_id VARCHAR(100) NOT NULL,
  team_id VARCHAR(100) NOT NULL,
  real_team_id VARCHAR(100) NOT NULL,
  real_team_name VARCHAR(255),
  fixture_id VARCHAR(100) NOT NULL,
  round_number INTEGER NOT NULL,
  bonus_breakdown JSONB DEFAULT '{}',
  total_bonus INTEGER DEFAULT 0,
  calculated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Ensure we don't award bonuses twice for the same fixture
  UNIQUE(league_id, team_id, fixture_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_fantasy_team_bonus_league ON fantasy_team_bonus_points(league_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_team_bonus_team ON fantasy_team_bonus_points(team_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_team_bonus_fixture ON fantasy_team_bonus_points(fixture_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_team_bonus_round ON fantasy_team_bonus_points(round_number);

COMMENT ON TABLE fantasy_team_bonus_points IS 'Tracks passive team affiliation bonuses awarded to fantasy teams based on their supported real team performance';
COMMENT ON COLUMN fantasy_team_bonus_points.bonus_breakdown IS 'JSON breakdown of bonus types and values (e.g., {"team_win": 5, "team_clean_sheet": 12})';
