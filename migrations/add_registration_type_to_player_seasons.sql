-- Migration: Add registration_type column to player_seasons table
-- Date: 2025-01-26
-- Description: Adds registration_type field to support confirmed/unconfirmed slot management

-- Add registration_type column (default to 'confirmed' for existing records)
ALTER TABLE player_seasons 
ADD COLUMN IF NOT EXISTS registration_type VARCHAR(20) DEFAULT 'confirmed';

-- Add comment for documentation
COMMENT ON COLUMN player_seasons.registration_type IS 'Type of registration slot: confirmed (guaranteed auction) or unconfirmed (waitlist)';

-- Update existing NULL values to 'confirmed'
UPDATE player_seasons 
SET registration_type = 'confirmed' 
WHERE registration_type IS NULL;

-- Create index for faster queries filtering by registration_type
CREATE INDEX IF NOT EXISTS idx_player_seasons_registration_type 
ON player_seasons(registration_type);

-- Create composite index for season + registration_type queries
CREATE INDEX IF NOT EXISTS idx_player_seasons_season_reg_type 
ON player_seasons(season_id, registration_type);

-- Verify the migration
SELECT COUNT(*) as total_records,
       COUNT(CASE WHEN registration_type = 'confirmed' THEN 1 END) as confirmed_count,
       COUNT(CASE WHEN registration_type = 'unconfirmed' THEN 1 END) as unconfirmed_count
FROM player_seasons;
