-- Create table to track fantasy team affiliation changes over time
-- This allows us to correctly calculate passive points even when teams change their supported team

CREATE TABLE IF NOT EXISTS fantasy_team_affiliation_history (
  id SERIAL PRIMARY KEY,
  league_id VARCHAR(100) NOT NULL,
  team_id VARCHAR(100) NOT NULL,
  supported_team_id VARCHAR(100),
  supported_team_name VARCHAR(255),
  effective_from_round INTEGER NOT NULL,
  effective_to_round INTEGER,
  changed_at TIMESTAMP DEFAULT NOW(),
  notes TEXT,
  
  -- Foreign key
  FOREIGN KEY (league_id) REFERENCES fantasy_leagues(league_id),
  FOREIGN KEY (team_id) REFERENCES fantasy_teams(team_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_affiliation_history_team ON fantasy_team_affiliation_history(team_id);
CREATE INDEX IF NOT EXISTS idx_affiliation_history_league ON fantasy_team_affiliation_history(league_id);
CREATE INDEX IF NOT EXISTS idx_affiliation_history_rounds ON fantasy_team_affiliation_history(effective_from_round, effective_to_round);

-- Add comments
COMMENT ON TABLE fantasy_team_affiliation_history IS 'Tracks the history of which real team each fantasy team was supporting, allowing correct passive point calculation when teams change affiliation';
COMMENT ON COLUMN fantasy_team_affiliation_history.effective_from_round IS 'The round number from which this affiliation became active (inclusive)';
COMMENT ON COLUMN fantasy_team_affiliation_history.effective_to_round IS 'The round number until which this affiliation was active (inclusive). NULL means still active';
COMMENT ON COLUMN fantasy_team_affiliation_history.notes IS 'Optional notes about why the change was made (e.g., "Changed during transfer window 2")';

-- Populate initial history from current fantasy_teams data
-- This creates a record for each team's current affiliation starting from round 1
INSERT INTO fantasy_team_affiliation_history (
  league_id,
  team_id,
  supported_team_id,
  supported_team_name,
  effective_from_round,
  effective_to_round,
  notes
)
SELECT 
  ft.league_id,
  ft.team_id,
  ft.supported_team_id,
  ft.supported_team_name,
  1 as effective_from_round,
  NULL as effective_to_round,
  'Initial affiliation (migrated from fantasy_teams table)' as notes
FROM fantasy_teams ft
WHERE ft.supported_team_id IS NOT NULL
  AND NOT EXISTS (
    -- Don't insert if history already exists for this team
    SELECT 1 FROM fantasy_team_affiliation_history fh
    WHERE fh.team_id = ft.team_id
  );

-- Show summary
SELECT 
  'Affiliation history initialized' as status,
  COUNT(*) as total_records,
  COUNT(DISTINCT team_id) as unique_teams
FROM fantasy_team_affiliation_history;
