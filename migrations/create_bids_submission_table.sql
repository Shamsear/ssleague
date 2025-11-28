-- Create bids_submission table to track when teams submit their bids for rounds
-- This allows teams to place multiple bids and then formally submit them

CREATE TABLE IF NOT EXISTS bids_submission (
  id SERIAL PRIMARY KEY,
  team_id VARCHAR(255) NOT NULL,
  round_id UUID NOT NULL,
  submitted_at TIMESTAMP DEFAULT NOW(),
  bid_count INTEGER DEFAULT 0,
  total_amount INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(team_id, round_id),
  FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_bids_submission_team ON bids_submission(team_id);
CREATE INDEX IF NOT EXISTS idx_bids_submission_round ON bids_submission(round_id);
CREATE INDEX IF NOT EXISTS idx_bids_submission_team_round ON bids_submission(team_id, round_id);

COMMENT ON TABLE bids_submission IS 'Tracks when teams formally submit their bids for auction rounds';
COMMENT ON COLUMN bids_submission.team_id IS 'ID of the team submitting bids';
COMMENT ON COLUMN bids_submission.round_id IS 'ID of the round for which bids are submitted';
COMMENT ON COLUMN bids_submission.submitted_at IS 'Timestamp when bids were submitted';
COMMENT ON COLUMN bids_submission.bid_count IS 'Number of bids submitted';
COMMENT ON COLUMN bids_submission.total_amount IS 'Total amount of all bids';
