-- Create table to store manual group assignments for teams in tournaments
-- This is used when group_assignment_mode = 'manual'

CREATE TABLE IF NOT EXISTS tournament_team_groups (
    id SERIAL PRIMARY KEY,
    tournament_id TEXT NOT NULL,
    team_id TEXT NOT NULL,
    group_name VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tournament_id, team_id),
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tournament_team_groups_tournament ON tournament_team_groups(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_team_groups_team ON tournament_team_groups(team_id);
CREATE INDEX IF NOT EXISTS idx_tournament_team_groups_group ON tournament_team_groups(group_name);

-- Add comment
COMMENT ON TABLE tournament_team_groups IS 'Stores manual group assignments for teams in tournaments with group stages';
COMMENT ON COLUMN tournament_team_groups.group_name IS 'Group identifier (A, B, C, D, etc.)';
