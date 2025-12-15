-- Add tracking fields to fixtures table for lineup and matchup management
-- This supports home team lineup editing and dual fixture creation

-- Add matchup creation tracking
ALTER TABLE fixtures
ADD COLUMN IF NOT EXISTS matchups_created_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS matchups_created_at TIMESTAMP;

-- Add lineup editing tracking
ALTER TABLE fixtures
ADD COLUMN IF NOT EXISTS lineup_last_edited_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS lineup_last_edited_at TIMESTAMP;

-- Create audit log for lineup changes
CREATE TABLE IF NOT EXISTS lineup_audit_log (
  id SERIAL PRIMARY KEY,
  fixture_id VARCHAR(255) NOT NULL,
  team_id VARCHAR(255) NOT NULL,
  action VARCHAR(50) NOT NULL, -- 'created', 'updated', 'deleted'
  previous_lineup JSONB,
  new_lineup JSONB,
  changed_by VARCHAR(255) NOT NULL,
  changed_at TIMESTAMP DEFAULT NOW(),
  reason TEXT,
  matchups_deleted BOOLEAN DEFAULT FALSE
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_lineup_audit_fixture ON lineup_audit_log(fixture_id);
CREATE INDEX IF NOT EXISTS idx_lineup_audit_team ON lineup_audit_log(team_id);
CREATE INDEX IF NOT EXISTS idx_fixtures_matchups_created ON fixtures(matchups_created_by, matchups_created_at);

-- Add comments for documentation
COMMENT ON COLUMN fixtures.matchups_created_by IS 'User ID of the team that created the matchups (for tracking first-come-first-served)';
COMMENT ON COLUMN fixtures.matchups_created_at IS 'Timestamp when matchups were created';
COMMENT ON COLUMN fixtures.lineup_last_edited_by IS 'User ID of the last person to edit lineup';
COMMENT ON COLUMN fixtures.lineup_last_edited_at IS 'Timestamp of last lineup edit';
COMMENT ON TABLE lineup_audit_log IS 'Audit trail for all lineup changes including edits and deletions';
