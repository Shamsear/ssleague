-- Add enable_category_requirements column to tournament_settings
-- This boolean flag determines whether category requirements should be enforced for lineups

ALTER TABLE tournament_settings 
ADD COLUMN IF NOT EXISTS enable_category_requirements BOOLEAN DEFAULT false;

-- Add comment
COMMENT ON COLUMN tournament_settings.enable_category_requirements IS 'Toggle to enable/disable category-based player requirements in lineups';
