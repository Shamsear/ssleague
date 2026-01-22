-- Tournament Penalties System Migration
-- Allows committee admins to deduct points from teams as penalties

-- Create tournament_penalties table
CREATE TABLE IF NOT EXISTS tournament_penalties (
  id SERIAL PRIMARY KEY,
  tournament_id VARCHAR(50) NOT NULL,
  season_id VARCHAR(50) NOT NULL,
  team_id VARCHAR(50) NOT NULL,
  team_name VARCHAR(255) NOT NULL,
  points_deducted INTEGER NOT NULL CHECK (points_deducted > 0),
  reason TEXT NOT NULL,
  applied_by_id VARCHAR(50) NOT NULL,
  applied_by_name VARCHAR(255) NOT NULL,
  applied_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  removed_by_id VARCHAR(50),
  removed_by_name VARCHAR(255),
  removed_at TIMESTAMP,
  removal_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT fk_tournament FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  CONSTRAINT fk_season FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_tournament_penalties_tournament ON tournament_penalties(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_penalties_team ON tournament_penalties(team_id);
CREATE INDEX IF NOT EXISTS idx_tournament_penalties_active ON tournament_penalties(is_active);
CREATE INDEX IF NOT EXISTS idx_tournament_penalties_season ON tournament_penalties(season_id);

-- Add points_deducted column to team_stats if it doesn't exist
ALTER TABLE team_stats
ADD COLUMN IF NOT EXISTS points_deducted INTEGER DEFAULT 0;

-- Add comments for documentation
COMMENT ON TABLE tournament_penalties IS 'Tracks point deductions/penalties applied to teams in tournaments';
COMMENT ON COLUMN tournament_penalties.points_deducted IS 'Number of points deducted from team (must be positive)';
COMMENT ON COLUMN tournament_penalties.reason IS 'Reason for penalty (e.g., late lineup, misconduct)';
COMMENT ON COLUMN tournament_penalties.is_active IS 'Whether penalty is currently active (false if removed/reversed)';
COMMENT ON COLUMN team_stats.points_deducted IS 'Total active penalty points deducted from this team';

-- Verify the migration
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'tournament_penalties'
ORDER BY ordinal_position;
