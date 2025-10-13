-- Add encrypted_bid_data column to bids table
-- This allows us to store encrypted bid information for blind bidding

-- Step 1: Add the new column (nullable for now)
ALTER TABLE bids ADD COLUMN IF NOT EXISTS encrypted_bid_data TEXT;

-- Note: We'll keep player_id and amount columns for now during transition
-- Once all bids are encrypted, we can drop these columns

-- To apply this migration:
-- 1. Go to your Neon console: https://console.neon.tech
-- 2. Select your database
-- 3. Go to SQL Editor
-- 4. Paste and run this SQL
