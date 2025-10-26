-- Add contract-related columns to player_seasons table
-- Run this in your Neon database (Tournament DB)

ALTER TABLE player_seasons
ADD COLUMN IF NOT EXISTS auction_value INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS salary_per_match DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS contract_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS contract_start_season VARCHAR(50),
ADD COLUMN IF NOT EXISTS contract_end_season VARCHAR(50),
ADD COLUMN IF NOT EXISTS contract_length INTEGER DEFAULT 1;

-- Add index for contract lookups
CREATE INDEX IF NOT EXISTS idx_player_seasons_contract_id ON player_seasons(contract_id);
CREATE INDEX IF NOT EXISTS idx_player_seasons_contract_season ON player_seasons(contract_start_season, contract_end_season);

-- Verify columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'player_seasons'
AND column_name IN ('auction_value', 'salary_per_match', 'contract_id', 'contract_start_season', 'contract_end_season', 'contract_length')
ORDER BY column_name;
