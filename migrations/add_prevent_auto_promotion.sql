-- Add prevent_auto_promotion column to player_seasons table
ALTER TABLE player_seasons 
ADD COLUMN IF NOT EXISTS prevent_auto_promotion BOOLEAN DEFAULT false;

-- Add index for better query performance when filtering by this column
CREATE INDEX IF NOT EXISTS idx_player_seasons_prevent_auto_promotion 
ON player_seasons(prevent_auto_promotion);
