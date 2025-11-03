-- Migration: Make bids.amount column nullable for blind bidding
-- This allows storing bid amounts ONLY in encrypted form until round finalization

-- Make amount column nullable
ALTER TABLE bids 
ALTER COLUMN amount DROP NOT NULL;

-- Add comment to explain the column
COMMENT ON COLUMN bids.amount IS 'Plain-text bid amount. NULL during active bidding (blind), populated after round finalization.';

-- The encrypted_bid_data column always contains the real bid amount in encrypted form
COMMENT ON COLUMN bids.encrypted_bid_data IS 'Encrypted bid data containing player_id and amount. Used for blind bidding.';
