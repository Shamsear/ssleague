-- Add contract season tracking to player_history

ALTER TABLE player_history 
ADD COLUMN IF NOT EXISTS contract_start_season VARCHAR(50),
ADD COLUMN IF NOT EXISTS contract_end_season VARCHAR(50);

-- Add index for contract queries
CREATE INDEX IF NOT EXISTS idx_player_history_contract_seasons 
ON player_history(contract_start_season, contract_end_season);

COMMENT ON COLUMN player_history.contract_start_season IS 'Contract start season (e.g., SSPSLS16, SSPSLS16.5)';
COMMENT ON COLUMN player_history.contract_end_season IS 'Contract end season (e.g., SSPSLS18, SSPSLS18.5)';
