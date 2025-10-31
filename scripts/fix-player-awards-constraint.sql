-- Fix player_awards table constraint
-- Drop old constraint and add new one matching the code

-- Drop the old constraint if it exists
ALTER TABLE player_awards 
DROP CONSTRAINT IF EXISTS unique_player_season_award;

-- Add the correct constraint
ALTER TABLE player_awards 
ADD CONSTRAINT unique_player_award 
UNIQUE(player_id, season_id, award_category, award_type, award_position);

SELECT '✅ Constraint updated successfully!' as status;