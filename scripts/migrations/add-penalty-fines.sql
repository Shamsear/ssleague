-- Add financial fine columns to tournament_penalties table

ALTER TABLE tournament_penalties
ADD COLUMN IF NOT EXISTS ecoin_fine INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sscoin_fine INTEGER DEFAULT 0;

-- Add comment
COMMENT ON COLUMN tournament_penalties.ecoin_fine IS 'Fine amount in ECoin';
COMMENT ON COLUMN tournament_penalties.sscoin_fine IS 'Fine amount in SSCoin';
