-- Add processed_fixtures column to player_seasons table
-- This prevents duplicate stat counting when the same fixture is processed multiple times

ALTER TABLE player_seasons 
ADD COLUMN IF NOT EXISTS processed_fixtures JSONB DEFAULT '[]'::jsonb;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_player_seasons_processed_fixtures 
ON player_seasons USING GIN (processed_fixtures);

-- Add comment for documentation
COMMENT ON COLUMN player_seasons.processed_fixtures IS 'Array of fixture IDs that have been processed for this player to prevent duplicate counting';
