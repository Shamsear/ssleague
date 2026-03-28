-- Add tier status tracking columns to fantasy_draft_tiers table
ALTER TABLE fantasy_draft_tiers
ADD COLUMN IF NOT EXISTS tier_status VARCHAR(20) DEFAULT 'pending' CHECK (tier_status IN ('pending', 'active', 'processing', 'closed')),
ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- Add current active tier tracking to fantasy_leagues
ALTER TABLE fantasy_leagues
ADD COLUMN IF NOT EXISTS current_active_tier INTEGER;

-- Create index for faster tier status queries
CREATE INDEX IF NOT EXISTS idx_fantasy_draft_tiers_status ON fantasy_draft_tiers(league_id, tier_status);

-- Add comment
COMMENT ON COLUMN fantasy_draft_tiers.tier_status IS 'Status of the tier: pending (not yet open), active (teams can bid), processing (admin is processing), closed (completed)';
COMMENT ON COLUMN fantasy_leagues.current_active_tier IS 'The tier number that is currently active for bidding (null if none active)';
