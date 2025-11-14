-- Create tournaments table with rewards system
CREATE TABLE IF NOT EXISTS tournaments (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL,
  tournament_type TEXT NOT NULL,
  tournament_name TEXT NOT NULL,
  tournament_code TEXT,
  status TEXT DEFAULT 'upcoming',
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  description TEXT,
  is_primary BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  include_in_fantasy BOOLEAN DEFAULT true,
  include_in_awards BOOLEAN DEFAULT true,
  
  -- Format settings
  has_league_stage BOOLEAN DEFAULT true,
  has_group_stage BOOLEAN DEFAULT false,
  group_assignment_mode TEXT DEFAULT 'auto',
  number_of_groups INTEGER DEFAULT 4,
  teams_per_group INTEGER DEFAULT 4,
  teams_advancing_per_group INTEGER DEFAULT 2,
  
  -- Knockout stage settings
  has_knockout_stage BOOLEAN DEFAULT false,
  playoff_teams INTEGER DEFAULT 4,
  direct_semifinal_teams INTEGER DEFAULT 2,
  qualification_threshold INTEGER DEFAULT 75,
  is_pure_knockout BOOLEAN DEFAULT false,
  
  -- Rewards configuration (NEW)
  rewards JSONB DEFAULT NULL,
  number_of_teams INTEGER DEFAULT 16,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Ensure unique combination of season and tournament type
  UNIQUE(season_id, tournament_type)
);

-- Add comment to explain rewards structure
COMMENT ON COLUMN tournaments.rewards IS 'Tournament rewards configuration in JSONB format containing:
- match_results: { win_ecoin, win_sscoin, draw_ecoin, draw_sscoin, loss_ecoin, loss_sscoin }
- league_positions: [{ position, ecoin, sscoin }, ...]
- knockout_stages: { winner, runner_up, semi_final_loser, quarter_final_loser, round_of_16_loser, round_of_32_loser }
- completion_bonus: { ecoin, sscoin }';

COMMENT ON COLUMN tournaments.number_of_teams IS 'Total number of teams participating in the tournament';

-- Create index for better query performance when filtering by rewards
CREATE INDEX IF NOT EXISTS idx_tournaments_rewards ON tournaments USING GIN (rewards);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tournaments_season_id ON tournaments(season_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_is_primary ON tournaments(is_primary) WHERE is_primary = true;

-- Example rewards structure:
-- {
--   "match_results": {
--     "win_ecoin": 100,
--     "win_sscoin": 10,
--     "draw_ecoin": 50,
--     "draw_sscoin": 5,
--     "loss_ecoin": 20,
--     "loss_sscoin": 2
--   },
--   "league_positions": [
--     { "position": 1, "ecoin": 5000, "sscoin": 500 },
--     { "position": 2, "ecoin": 3000, "sscoin": 300 },
--     { "position": 3, "ecoin": 2000, "sscoin": 200 }
--   ],
--   "knockout_stages": {
--     "winner": { "ecoin": 5000, "sscoin": 500 },
--     "runner_up": { "ecoin": 3000, "sscoin": 300 },
--     "semi_final_loser": { "ecoin": 1500, "sscoin": 150 },
--     "quarter_final_loser": { "ecoin": 750, "sscoin": 75 }
--   },
--   "completion_bonus": {
--     "ecoin": 500,
--     "sscoin": 50
--   }
-- }
