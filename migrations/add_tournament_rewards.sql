-- Add rewards column to tournaments table
-- This column stores eCoin and SSCoin rewards configuration for tournaments

ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS rewards JSONB DEFAULT NULL;

-- Add number_of_teams column
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS number_of_teams INTEGER DEFAULT 16;

-- Add comment to explain the column structure
COMMENT ON COLUMN tournaments.rewards IS 'Tournament rewards configuration in JSONB format containing:
- match_results: { win_ecoin, win_sscoin, draw_ecoin, draw_sscoin, loss_ecoin, loss_sscoin }
- league_positions: [{ position, ecoin, sscoin }, ...]
- knockout_stages: { winner, runner_up, semi_final_loser, quarter_final_loser, round_of_16_loser, round_of_32_loser }
- completion_bonus: { ecoin, sscoin }';

-- Create an index for better query performance when filtering by rewards
CREATE INDEX IF NOT EXISTS idx_tournaments_rewards ON tournaments USING GIN (rewards);

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
--     { "position": 3, "ecoin": 2000, "sscoin": 200 },
--     { "position": 4, "ecoin": 1000, "sscoin": 100 }
--   ],
--   "knockout_stages": {
--     "winner": { "ecoin": 5000, "sscoin": 500 },
--     "runner_up": { "ecoin": 3000, "sscoin": 300 },
--     "semi_final_loser": { "ecoin": 1500, "sscoin": 150 },
--     "quarter_final_loser": { "ecoin": 750, "sscoin": 75 },
--     "round_of_16_loser": { "ecoin": 400, "sscoin": 40 },
--     "round_of_32_loser": { "ecoin": 200, "sscoin": 20 }
--   },
--   "completion_bonus": {
--     "ecoin": 500,
--     "sscoin": 50
--   }
-- }
