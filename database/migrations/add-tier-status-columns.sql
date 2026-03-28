-- Add tier-by-tier draft control columns
-- This migration adds columns to support tier-by-tier draft workflow

-- Add current_active_tier to fantasy_leagues
ALTER TABLE fantasy_leagues 
ADD COLUMN IF NOT EXISTS current_active_tier INTEGER DEFAULT NULL;

-- Add tier_status to fantasy_draft_tiers
ALTER TABLE fantasy_draft_tiers
ADD COLUMN IF NOT EXISTS tier_status VARCHAR(20) DEFAULT 'pending' CHECK (tier_status IN ('pending', 'active', 'processing', 'closed'));

-- Add opened_at and closed_at timestamps
ALTER TABLE fantasy_draft_tiers
ADD COLUMN IF NOT EXISTS opened_at TIMESTAMP DEFAULT NULL,
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP DEFAULT NULL;

-- Create index for faster tier status queries
CREATE INDEX IF NOT EXISTS idx_fantasy_draft_tiers_status ON fantasy_draft_tiers(league_id, draft_type, tier_status);

-- Comments
COMMENT ON COLUMN fantasy_leagues.current_active_tier IS 'The tier number currently open for bidding (NULL if no tier is active)';
COMMENT ON COLUMN fantasy_draft_tiers.tier_status IS 'Status: pending (not started), active (open for bids), processing (being processed), closed (completed)';
COMMENT ON COLUMN fantasy_draft_tiers.opened_at IS 'When this tier was opened for bidding';
COMMENT ON COLUMN fantasy_draft_tiers.closed_at IS 'When this tier was closed';
