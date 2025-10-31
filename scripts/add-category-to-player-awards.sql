-- Add category column to player_awards table
-- This allows filtering awards by player category (White, Red, Blue, etc.)
-- Category trophies will have a category value
-- Individual trophies will have NULL category

ALTER TABLE player_awards 
ADD COLUMN IF NOT EXISTS category VARCHAR(50);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_player_awards_category ON player_awards(category);

-- Create index for category + award_name combination
CREATE INDEX IF NOT EXISTS idx_player_awards_category_award ON player_awards(category, award_name);

-- Update notes for existing records to clarify trophy type
UPDATE player_awards 
SET notes = 'Individual Trophy (League-wide)' 
WHERE notes = 'Individual Trophy' AND category IS NULL;

COMMENT ON COLUMN player_awards.category IS 'Player category for category-based awards (e.g., White, Red, Blue). NULL for individual/league-wide awards.';
