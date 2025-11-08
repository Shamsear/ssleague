-- Add auction_window to rounds table to support different auction contexts
-- This allows creating rounds for season start, transfer windows, or mid-season auctions

ALTER TABLE rounds
ADD COLUMN IF NOT EXISTS auction_window VARCHAR(50) DEFAULT 'season_start';

-- Add comment for documentation
COMMENT ON COLUMN rounds.auction_window IS 'Auction context: season_start, transfer_window, mid_season, winter_window, summer_window, etc.';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_rounds_auction_window ON rounds(season_id, auction_window);

-- Update existing rounds to be season_start
UPDATE rounds
SET auction_window = 'season_start'
WHERE auction_window IS NULL;

SELECT 'Auction window column added successfully!' as status;
