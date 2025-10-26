-- Fantasy League Database Schema
-- This database is completely separate from Firestore and tournament/auction databases

-- Fantasy Leagues (seasons/competitions)
CREATE TABLE fantasy_leagues (
  id SERIAL PRIMARY KEY,
  league_id VARCHAR(100) UNIQUE NOT NULL,
  season_id VARCHAR(100) NOT NULL,
  season_name VARCHAR(255) NOT NULL,
  league_name VARCHAR(255) NOT NULL,
  budget_per_team DECIMAL(12, 2) DEFAULT 100.00,
  max_squad_size INTEGER DEFAULT 15,
  max_transfers_per_window INTEGER DEFAULT 2,
  points_cost_per_transfer INTEGER DEFAULT 4,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fantasy Teams (user teams in a league)
CREATE TABLE fantasy_teams (
  id SERIAL PRIMARY KEY,
  team_id VARCHAR(100) UNIQUE NOT NULL,
  league_id VARCHAR(100) NOT NULL REFERENCES fantasy_leagues(league_id),
  real_team_id VARCHAR(100),
  real_team_name VARCHAR(255),
  owner_uid VARCHAR(100) NOT NULL,
  owner_name VARCHAR(255),
  team_name VARCHAR(255) NOT NULL,
  total_points INTEGER DEFAULT 0,
  rank INTEGER,
  budget_remaining DECIMAL(12, 2),
  is_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fantasy Players (real players with fantasy prices)
CREATE TABLE fantasy_players (
  id SERIAL PRIMARY KEY,
  league_id VARCHAR(100) NOT NULL REFERENCES fantasy_leagues(league_id),
  real_player_id VARCHAR(100) NOT NULL,
  player_name VARCHAR(255) NOT NULL,
  position VARCHAR(50),
  real_team_id VARCHAR(100),
  real_team_name VARCHAR(255),
  star_rating INTEGER DEFAULT 3,
  draft_price DECIMAL(10, 2) NOT NULL,
  current_price DECIMAL(10, 2) NOT NULL,
  category VARCHAR(100),
  times_drafted INTEGER DEFAULT 0,
  total_points INTEGER DEFAULT 0,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(league_id, real_player_id)
);

-- Fantasy Drafts (player selections)
CREATE TABLE fantasy_drafts (
  id SERIAL PRIMARY KEY,
  draft_id VARCHAR(100) UNIQUE NOT NULL,
  league_id VARCHAR(100) NOT NULL REFERENCES fantasy_leagues(league_id),
  team_id VARCHAR(100) NOT NULL REFERENCES fantasy_teams(team_id),
  real_player_id VARCHAR(100) NOT NULL,
  player_name VARCHAR(255) NOT NULL,
  position VARCHAR(50),
  real_team_name VARCHAR(255),
  draft_price DECIMAL(10, 2) NOT NULL,
  draft_order INTEGER,
  drafted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fantasy Squad (current active squad)
CREATE TABLE fantasy_squad (
  id SERIAL PRIMARY KEY,
  squad_id VARCHAR(100) UNIQUE NOT NULL,
  team_id VARCHAR(100) NOT NULL REFERENCES fantasy_teams(team_id),
  league_id VARCHAR(100) NOT NULL REFERENCES fantasy_leagues(league_id),
  real_player_id VARCHAR(100) NOT NULL,
  player_name VARCHAR(255) NOT NULL,
  position VARCHAR(50),
  real_team_name VARCHAR(255),
  purchase_price DECIMAL(10, 2) NOT NULL,
  current_value DECIMAL(10, 2) NOT NULL,
  total_points INTEGER DEFAULT 0,
  is_captain BOOLEAN DEFAULT FALSE,
  is_vice_captain BOOLEAN DEFAULT FALSE,
  acquisition_type VARCHAR(50) DEFAULT 'draft',
  acquired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transfer Windows
CREATE TABLE transfer_windows (
  id SERIAL PRIMARY KEY,
  window_id VARCHAR(100) UNIQUE NOT NULL,
  league_id VARCHAR(100) NOT NULL REFERENCES fantasy_leagues(league_id),
  window_name VARCHAR(255) NOT NULL,
  opens_at TIMESTAMP NOT NULL,
  closes_at TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fantasy Transfers
CREATE TABLE fantasy_transfers (
  id SERIAL PRIMARY KEY,
  transfer_id VARCHAR(100) UNIQUE NOT NULL,
  league_id VARCHAR(100) NOT NULL REFERENCES fantasy_leagues(league_id),
  team_id VARCHAR(100) NOT NULL REFERENCES fantasy_teams(team_id),
  window_id VARCHAR(100) REFERENCES transfer_windows(window_id),
  player_out_id VARCHAR(100),
  player_out_name VARCHAR(255),
  player_in_id VARCHAR(100),
  player_in_name VARCHAR(255),
  transfer_cost INTEGER DEFAULT 0,
  points_deducted INTEGER DEFAULT 0,
  is_free_transfer BOOLEAN DEFAULT TRUE,
  transferred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fantasy Player Points (matchday performance)
CREATE TABLE fantasy_player_points (
  id SERIAL PRIMARY KEY,
  league_id VARCHAR(100) NOT NULL REFERENCES fantasy_leagues(league_id),
  team_id VARCHAR(100) NOT NULL REFERENCES fantasy_teams(team_id),
  real_player_id VARCHAR(100) NOT NULL,
  player_name VARCHAR(255) NOT NULL,
  fixture_id VARCHAR(100),
  round_number INTEGER,
  goals_scored INTEGER DEFAULT 0,
  goals_conceded INTEGER DEFAULT 0,
  clean_sheet BOOLEAN DEFAULT FALSE,
  motm BOOLEAN DEFAULT FALSE,
  base_points INTEGER DEFAULT 0,
  bonus_points INTEGER DEFAULT 0,
  total_points INTEGER DEFAULT 0,
  is_captain BOOLEAN DEFAULT FALSE,
  points_multiplier INTEGER DEFAULT 1,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Leaderboard (cached for performance)
CREATE TABLE fantasy_leaderboard (
  id SERIAL PRIMARY KEY,
  league_id VARCHAR(100) NOT NULL REFERENCES fantasy_leagues(league_id),
  team_id VARCHAR(100) NOT NULL REFERENCES fantasy_teams(team_id),
  team_name VARCHAR(255) NOT NULL,
  owner_name VARCHAR(255),
  total_points INTEGER DEFAULT 0,
  rank INTEGER NOT NULL,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(league_id, team_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_fantasy_teams_league ON fantasy_teams(league_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_teams_owner ON fantasy_teams(owner_uid);
CREATE INDEX IF NOT EXISTS idx_fantasy_players_league ON fantasy_players(league_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_drafts_team ON fantasy_drafts(team_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_squad_team ON fantasy_squad(team_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_transfers_team ON fantasy_transfers(team_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_player_points_team ON fantasy_player_points(team_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_leaderboard_league ON fantasy_leaderboard(league_id);
