-- Add season_id to all auction tables that are missing it
-- This prevents confusion when running multiple seasons

-- Add to bids (can get from rounds.season_id)
ALTER TABLE bids 
ADD COLUMN IF NOT EXISTS season_id VARCHAR(255);

-- Add to round_players (can get from rounds.season_id)
ALTER TABLE round_players 
ADD COLUMN IF NOT EXISTS season_id VARCHAR(255);

-- Add to round_bids (can get from rounds.season_id)
ALTER TABLE round_bids 
ADD COLUMN IF NOT EXISTS season_id VARCHAR(255);

-- Add to starred_players (can get from teams.season_id)
ALTER TABLE starred_players 
ADD COLUMN IF NOT EXISTS season_id VARCHAR(255);

-- Add to team_tiebreakers (can get from tiebreakers -> rounds.season_id)
ALTER TABLE team_tiebreakers 
ADD COLUMN IF NOT EXISTS season_id VARCHAR(255);

-- Add to bulk_tiebreaker_teams
ALTER TABLE bulk_tiebreaker_teams 
ADD COLUMN IF NOT EXISTS season_id VARCHAR(255);

-- Add to bulk_tiebreaker_bids
ALTER TABLE bulk_tiebreaker_bids 
ADD COLUMN IF NOT EXISTS season_id VARCHAR(255);

-- Add to tournament_settings
ALTER TABLE tournament_settings 
ADD COLUMN IF NOT EXISTS season_id VARCHAR(255);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_bids_season_id ON bids(season_id);
CREATE INDEX IF NOT EXISTS idx_round_players_season_id ON round_players(season_id);
CREATE INDEX IF NOT EXISTS idx_starred_players_season_id ON starred_players(season_id);
CREATE INDEX IF NOT EXISTS idx_team_tiebreakers_season_id ON team_tiebreakers(season_id);

-- Add comments
COMMENT ON COLUMN bids.season_id IS 'Season identifier to prevent cross-season confusion';
COMMENT ON COLUMN round_players.season_id IS 'Season identifier to prevent cross-season confusion';
COMMENT ON COLUMN starred_players.season_id IS 'Season identifier to prevent cross-season confusion';
COMMENT ON COLUMN team_tiebreakers.season_id IS 'Season identifier to prevent cross-season confusion';
