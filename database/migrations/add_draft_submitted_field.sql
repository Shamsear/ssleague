-- Add draft_submitted field to fantasy_teams table
ALTER TABLE fantasy_teams
ADD COLUMN IF NOT EXISTS draft_submitted BOOLEAN DEFAULT FALSE;

-- Add index for filtering submitted drafts
CREATE INDEX IF NOT EXISTS idx_fantasy_teams_draft_submitted ON fantasy_teams(draft_submitted);
