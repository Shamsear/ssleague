-- Rename encrypted_amount to encrypted_bid_data in bids table
ALTER TABLE bids 
RENAME COLUMN encrypted_amount TO encrypted_bid_data;

-- Add comment
COMMENT ON COLUMN bids.encrypted_bid_data IS 'Encrypted bid data for blind bidding';
