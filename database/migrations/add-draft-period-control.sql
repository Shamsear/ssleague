-- Add draft period control to fantasy_leagues table

ALTER TABLE fantasy_leagues 
ADD COLUMN IF NOT EXISTS draft_status VARCHAR(20) DEFAULT 'pending' CHECK (draft_status IN ('pending', 'active', 'closed')),
ADD COLUMN IF NOT EXISTS draft_opens_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS draft_closes_at TIMESTAMP;

-- Add comments
COMMENT ON COLUMN fantasy_leagues.draft_status IS 'Draft period status: pending (not started), active (open for drafting), closed (draft ended)';
COMMENT ON COLUMN fantasy_leagues.draft_opens_at IS 'When the draft period opens';
COMMENT ON COLUMN fantasy_leagues.draft_closes_at IS 'When the draft period closes';

-- Create index for quick status checks
CREATE INDEX IF NOT EXISTS idx_fantasy_leagues_draft_status ON fantasy_leagues(draft_status);

SELECT '✅ Draft period control columns added successfully!' as status;
