-- Add min_squad_size column to fantasy_leagues table
ALTER TABLE fantasy_leagues 
ADD COLUMN IF NOT EXISTS min_squad_size INTEGER DEFAULT 11;

-- Add comment
COMMENT ON COLUMN fantasy_leagues.min_squad_size IS 'Minimum number of players required in a fantasy team squad';

-- Update existing records to have default value
UPDATE fantasy_leagues 
SET min_squad_size = 11 
WHERE min_squad_size IS NULL;
