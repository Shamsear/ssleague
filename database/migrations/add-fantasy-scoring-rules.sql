-- Fantasy Scoring Rules Table
-- This table stores the point values for different fantasy scoring events

CREATE TABLE IF NOT EXISTS fantasy_scoring_rules (
  id SERIAL PRIMARY KEY,
  rule_id VARCHAR(100) UNIQUE NOT NULL,
  league_id VARCHAR(100) NOT NULL REFERENCES fantasy_leagues(league_id),
  rule_type VARCHAR(100) NOT NULL,
  rule_name VARCHAR(255) NOT NULL,
  points_value INTEGER NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(league_id, rule_type)
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_fantasy_scoring_rules_league ON fantasy_scoring_rules(league_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_scoring_rules_active ON fantasy_scoring_rules(league_id, is_active);

-- Insert default scoring rules (these will be used if no custom rules are set)
-- Note: You'll need to insert these for each league that's created
-- Common scoring rules:
-- - goals_scored: Points for scoring a goal (e.g., 5 points)
-- - goals_conceded: Points deducted for conceding a goal (e.g., -1 points)
-- - win: Points for winning a match (e.g., 3 points)
-- - draw: Points for drawing a match (e.g., 1 point)
-- - loss: Points for losing a match (e.g., 0 points)
-- - clean_sheet: Bonus for not conceding any goals (e.g., 4 points)
-- - motm: Bonus for being Man of the Match (e.g., 5 points)
-- - fine_goals: Penalty for fine goals (e.g., -2 points)
-- - substitution_penalty: Penalty for substitutions (e.g., -1 point)
