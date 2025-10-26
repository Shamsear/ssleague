-- Create scoring rules table for custom fantasy scoring
CREATE TABLE IF NOT EXISTS scoring_rules (
  rule_id SERIAL PRIMARY KEY,
  league_id VARCHAR(100) NOT NULL,
  rule_name VARCHAR(255) NOT NULL,
  rule_type VARCHAR(100) NOT NULL,
  description TEXT,
  points_value DECIMAL(10, 2) NOT NULL,
  applies_to VARCHAR(50) DEFAULT 'player',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_league FOREIGN KEY (league_id) REFERENCES fantasy_leagues(league_id) ON DELETE CASCADE
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_scoring_rules_league ON scoring_rules(league_id);
CREATE INDEX IF NOT EXISTS idx_scoring_rules_active ON scoring_rules(league_id, is_active);

-- Add comments
COMMENT ON TABLE scoring_rules IS 'Custom scoring rules for fantasy leagues';
COMMENT ON COLUMN scoring_rules.rule_type IS 'Type of event: goal, assist, clean_sheet, team_win, etc.';
COMMENT ON COLUMN scoring_rules.applies_to IS 'Who gets points: player, team, or both';
COMMENT ON COLUMN scoring_rules.points_value IS 'Points awarded/deducted when rule triggers';

SELECT '✅ Scoring rules table created successfully!' as status;
