-- ============================================
-- ADD TROPHY_POSITION COLUMN TO TEAM_TROPHIES
-- Separates trophy name from position/achievement
-- Note: 'position' column (INTEGER) is for league position (1, 2, 3)
--       'trophy_position' column (VARCHAR) is for achievement text (Winner, Runner Up, etc.)
-- ============================================

-- Add trophy_position column for text-based position/achievement
ALTER TABLE team_trophies 
ADD COLUMN IF NOT EXISTS trophy_position VARCHAR(50);

-- Update comments
COMMENT ON COLUMN team_trophies.trophy_name IS 'Trophy name only: League, UCL, FA Cup, etc. (without position)';
COMMENT ON COLUMN team_trophies.trophy_position IS 'Trophy achievement: Winner, Runner Up, Champions, Third Place, etc.';
COMMENT ON COLUMN team_trophies.position IS 'League standing position (INTEGER): 1, 2, 3, etc. - for league position only';

-- Update unique constraint to include trophy_position
ALTER TABLE team_trophies 
DROP CONSTRAINT IF EXISTS team_trophies_team_id_season_id_trophy_name_key;

ALTER TABLE team_trophies 
ADD CONSTRAINT team_trophies_unique_trophy 
UNIQUE(team_id, season_id, trophy_name, trophy_position);

-- Add index for trophy_position
CREATE INDEX IF NOT EXISTS idx_team_trophies_trophy_position 
ON team_trophies(trophy_position);

SELECT '✅ trophy_position column added successfully!' as status;
