-- Add lineup category requirement columns to tournament_settings
-- These define minimum player counts per category for starting XI

ALTER TABLE tournament_settings 
ADD COLUMN IF NOT EXISTS min_classic_players INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS min_legend_players INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS min_rising_star_players INTEGER DEFAULT 0;

-- Add comment
COMMENT ON COLUMN tournament_settings.min_classic_players IS 'Minimum number of classic category players required in starting XI';
COMMENT ON COLUMN tournament_settings.min_legend_players IS 'Minimum number of legend category players required in starting XI';
COMMENT ON COLUMN tournament_settings.min_rising_star_players IS 'Minimum number of rising star category players required in starting XI';
