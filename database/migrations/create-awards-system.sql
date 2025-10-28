-- Awards System Schema
-- Supports POTD, POTW, Team of Day/Week/Season, Player of Season

CREATE TABLE IF NOT EXISTS awards (
  id TEXT PRIMARY KEY,
  
  -- Award Type
  award_type VARCHAR(20) NOT NULL, -- 'POTD', 'POTW', 'TOD', 'TOW', 'POTS', 'TOTS'
  
  -- Context
  tournament_id TEXT NOT NULL,
  season_id TEXT NOT NULL,
  round_number INTEGER, -- For POTD/TOD
  week_number INTEGER, -- For POTW/TOW (7 rounds = 1 week)
  
  -- Winner (Player or Team)
  player_id TEXT, -- For player awards
  player_name TEXT,
  team_id TEXT, -- For team awards or player's team
  team_name TEXT,
  
  -- Performance Stats (JSON for flexibility)
  performance_stats JSONB,
  
  -- Selection Info
  selected_by TEXT NOT NULL, -- Admin user ID
  selected_by_name TEXT,
  selected_at TIMESTAMP DEFAULT NOW(),
  
  -- Notes
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CHECK (
    (award_type IN ('POTD', 'TOD') AND round_number IS NOT NULL) OR
    (award_type IN ('POTW', 'TOW') AND week_number IS NOT NULL) OR
    (award_type IN ('POTS', 'TOTS'))
  ),
  CHECK (
    (award_type IN ('POTD', 'POTW', 'POTS') AND player_id IS NOT NULL) OR
    (award_type IN ('TOD', 'TOW', 'TOTS') AND team_id IS NOT NULL)
  )
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_awards_tournament_season 
ON awards(tournament_id, season_id);

CREATE INDEX IF NOT EXISTS idx_awards_type 
ON awards(award_type);

CREATE INDEX IF NOT EXISTS idx_awards_round 
ON awards(tournament_id, season_id, round_number);

CREATE INDEX IF NOT EXISTS idx_awards_week 
ON awards(tournament_id, season_id, week_number);

CREATE INDEX IF NOT EXISTS idx_awards_player 
ON awards(player_id);

CREATE INDEX IF NOT EXISTS idx_awards_team 
ON awards(team_id);

-- Unique constraints to prevent duplicate awards
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_potd 
ON awards(tournament_id, season_id, round_number) 
WHERE award_type = 'POTD';

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_potw 
ON awards(tournament_id, season_id, week_number) 
WHERE award_type = 'POTW';

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_tod 
ON awards(tournament_id, season_id, round_number) 
WHERE award_type = 'TOD';

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_tow 
ON awards(tournament_id, season_id, week_number) 
WHERE award_type = 'TOW';

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pots 
ON awards(tournament_id, season_id) 
WHERE award_type = 'POTS';

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_tots 
ON awards(tournament_id, season_id) 
WHERE award_type = 'TOTS';

-- Sample performance_stats structure:
-- {
--   "goals": 5,
--   "assists": 2,
--   "motm_count": 1,
--   "potd_count": 3,
--   "wins": 1,
--   "result": "Won 6-1",
--   "goal_difference": 5,
--   "clean_sheet": false,
--   "total_rounds": 22
-- }
