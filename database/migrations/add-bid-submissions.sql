-- Create bid_submissions table to track when teams submit their bids
CREATE TABLE IF NOT EXISTS bid_submissions (
  id SERIAL PRIMARY KEY,
  team_id VARCHAR(50) NOT NULL,
  round_id VARCHAR(50) NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  bid_count INTEGER NOT NULL,
  is_locked BOOLEAN DEFAULT true,
  unlocked_at TIMESTAMPTZ,
  unlocked_by VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, round_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_bid_submissions_round ON bid_submissions(round_id);
CREATE INDEX IF NOT EXISTS idx_bid_submissions_team ON bid_submissions(team_id);
CREATE INDEX IF NOT EXISTS idx_bid_submissions_locked ON bid_submissions(is_locked);

-- Add comment
COMMENT ON TABLE bid_submissions IS 'Tracks when teams submit their bids for a round';
