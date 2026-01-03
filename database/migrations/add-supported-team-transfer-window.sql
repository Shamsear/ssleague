-- Migration: Add Supported Team Transfer Window Feature
-- Description: Allow admin to create a one-time window for teams to change their supported team for free

-- Add columns to transfer_windows table
ALTER TABLE transfer_windows
ADD COLUMN IF NOT EXISTS window_type VARCHAR(50) DEFAULT 'player_transfer',
ADD COLUMN IF NOT EXISTS allow_supported_team_change BOOLEAN DEFAULT false;

-- Add tracking for supported team changes
CREATE TABLE IF NOT EXISTS supported_team_changes (
  id SERIAL PRIMARY KEY,
  change_id VARCHAR(100) UNIQUE NOT NULL,
  league_id VARCHAR(100) NOT NULL,
  team_id VARCHAR(100) NOT NULL,
  window_id VARCHAR(100) NOT NULL,
  
  -- Old supported team
  old_supported_team_id VARCHAR(100),
  old_supported_team_name VARCHAR(255),
  
  -- New supported team
  new_supported_team_id VARCHAR(100) NOT NULL,
  new_supported_team_name VARCHAR(255) NOT NULL,
  
  -- Metadata
  changed_by VARCHAR(100) NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reason TEXT,
  
  FOREIGN KEY (league_id) REFERENCES fantasy_leagues(league_id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES fantasy_teams(team_id) ON DELETE CASCADE,
  FOREIGN KEY (window_id) REFERENCES transfer_windows(window_id) ON DELETE CASCADE
);

-- Add index for quick lookups
CREATE INDEX IF NOT EXISTS idx_supported_team_changes_team ON supported_team_changes(team_id);
CREATE INDEX IF NOT EXISTS idx_supported_team_changes_window ON supported_team_changes(window_id);
CREATE INDEX IF NOT EXISTS idx_supported_team_changes_league ON supported_team_changes(league_id);

-- Add comments
COMMENT ON TABLE supported_team_changes IS 'Tracks when teams change their supported team during special windows';
COMMENT ON COLUMN transfer_windows.window_type IS 'Type of window: player_transfer or supported_team_change';
COMMENT ON COLUMN transfer_windows.allow_supported_team_change IS 'If true, teams can change their supported team during this window';
