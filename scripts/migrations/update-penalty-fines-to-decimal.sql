-- Change penalty fine columns from INTEGER to NUMERIC to support decimal values

ALTER TABLE tournament_penalties
ALTER COLUMN ecoin_fine TYPE NUMERIC(10, 2),
ALTER COLUMN sscoin_fine TYPE NUMERIC(10, 2);

-- Update comments
COMMENT ON COLUMN tournament_penalties.ecoin_fine IS 'Fine amount in ECoin (supports decimals, e.g., 125.50)';
COMMENT ON COLUMN tournament_penalties.sscoin_fine IS 'Fine amount in SSCoin (supports decimals, e.g., 62.75)';
