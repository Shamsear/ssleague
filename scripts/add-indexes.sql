-- Add indexes to speed up team dashboard queries
-- Run this on Neon Tournament Database

-- Index for teamstats queries by team_name
CREATE INDEX IF NOT EXISTS idx_teamstats_team_name ON teamstats(team_name);

-- Index for teamstats queries by team_id
CREATE INDEX IF NOT EXISTS idx_teamstats_team_id ON teamstats(team_id);

-- Index for realplayerstats queries by team
CREATE INDEX IF NOT EXISTS idx_realplayerstats_team ON realplayerstats(team);

-- Index for realplayerstats queries by team_id
CREATE INDEX IF NOT EXISTS idx_realplayerstats_team_id ON realplayerstats(team_id);

-- Composite index for player stats by team and season
CREATE INDEX IF NOT EXISTS idx_realplayerstats_team_season ON realplayerstats(team, season_id);

-- Composite index for team stats by team and season
CREATE INDEX IF NOT EXISTS idx_teamstats_team_season ON teamstats(team_name, season_id);

-- Index for player stats by player_id (for player details page)
CREATE INDEX IF NOT EXISTS idx_realplayerstats_player_id ON realplayerstats(player_id);

-- Analyze tables to update statistics
ANALYZE teamstats;
ANALYZE realplayerstats;
