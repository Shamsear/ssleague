-- Add tournament_id column to player_awards table for tournament-specific awards
-- This allows awards to be given per tournament instead of just per season

-- Add tournament_id column (nullable for backward compatibility with season-wide awards)
ALTER TABLE player_awards
ADD COLUMN IF NOT EXISTS tournament_id VARCHAR(255);

-- Add index for tournament_id lookups
CREATE INDEX IF NOT EXISTS idx_player_awards_tournament_id ON player_awards(tournament_id);

-- Update the unique constraint to include tournament_id
-- First drop the old constraint
ALTER TABLE player_awards
DROP CONSTRAINT IF EXISTS player_awards_player_id_season_id_award_category_award_type_key;

-- Add new constraint that includes tournament_id
-- This allows same award to be given in different tournaments
ALTER TABLE player_awards
ADD CONSTRAINT player_awards_unique_award 
UNIQUE NULLS NOT DISTINCT (player_id, season_id, tournament_id, award_category, award_type, award_position);

-- Add comment
COMMENT ON COLUMN player_awards.tournament_id IS 'Tournament ID for tournament-specific awards. NULL for season-wide awards.';
