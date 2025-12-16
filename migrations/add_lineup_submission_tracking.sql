-- Add lineup submission tracking columns to fixtures table
ALTER TABLE fixtures
ADD COLUMN IF NOT EXISTS home_lineup_submitted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS home_lineup_submitted_by VARCHAR(100),
ADD COLUMN IF NOT EXISTS away_lineup_submitted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS away_lineup_submitted_by VARCHAR(100);

-- Create team violations table to track penalties
CREATE TABLE IF NOT EXISTS team_violations (
  id SERIAL PRIMARY KEY,
  team_id VARCHAR(100) NOT NULL,
  season_id VARCHAR(100) NOT NULL,
  violation_type VARCHAR(50) NOT NULL, -- 'late_lineup', 'no_lineup', 'late_result', etc.
  fixture_id VARCHAR(100),
  round_number INTEGER,
  violation_date TIMESTAMP NOT NULL,
  deadline TIMESTAMP,
  minutes_late INTEGER,
  penalty_applied VARCHAR(100), -- 'warning_deducted', 'goal_penalty', 'fine', etc.
  penalty_amount INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_team_violations_team ON team_violations(team_id);
CREATE INDEX IF NOT EXISTS idx_team_violations_season ON team_violations(season_id);
CREATE INDEX IF NOT EXISTS idx_team_violations_type ON team_violations(violation_type);
CREATE INDEX IF NOT EXISTS idx_team_violations_fixture ON team_violations(fixture_id);

-- Add warning chances tracking to team_seasons (if not exists)
-- This would typically be in Firebase, but we'll track violations in PostgreSQL

COMMENT ON TABLE team_violations IS 'Tracks all team violations and penalties applied';
COMMENT ON COLUMN team_violations.violation_type IS 'Type of violation: late_lineup, no_lineup, late_result, etc.';
COMMENT ON COLUMN team_violations.penalty_applied IS 'What penalty was applied: warning_deducted, goal_penalty, fine, etc.';
