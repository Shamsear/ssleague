-- Add all footballplayers columns to player_history table
-- This allows player_history to store complete player information for historical display

ALTER TABLE player_history
ADD COLUMN IF NOT EXISTS position_group VARCHAR(50),
ADD COLUMN IF NOT EXISTS overall_rating INTEGER,
ADD COLUMN IF NOT EXISTS nationality VARCHAR(100),
ADD COLUMN IF NOT EXISTS age INTEGER,
ADD COLUMN IF NOT EXISTS playing_style VARCHAR(100),
ADD COLUMN IF NOT EXISTS club VARCHAR(255),
ADD COLUMN IF NOT EXISTS is_sold BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS speed INTEGER,
ADD COLUMN IF NOT EXISTS acceleration INTEGER,
ADD COLUMN IF NOT EXISTS ball_control INTEGER,
ADD COLUMN IF NOT EXISTS dribbling INTEGER,
ADD COLUMN IF NOT EXISTS low_pass INTEGER,
ADD COLUMN IF NOT EXISTS lofted_pass INTEGER,
ADD COLUMN IF NOT EXISTS finishing INTEGER,
ADD COLUMN IF NOT EXISTS heading INTEGER,
ADD COLUMN IF NOT EXISTS physical_contact INTEGER,
ADD COLUMN IF NOT EXISTS stamina INTEGER,
ADD COLUMN IF NOT EXISTS defensive_awareness INTEGER,
ADD COLUMN IF NOT EXISTS ball_winning INTEGER,
ADD COLUMN IF NOT EXISTS aggression INTEGER,
ADD COLUMN IF NOT EXISTS gk_reflexes INTEGER,
ADD COLUMN IF NOT EXISTS gk_reach INTEGER,
ADD COLUMN IF NOT EXISTS gk_handling INTEGER,
ADD COLUMN IF NOT EXISTS weak_foot_usage INTEGER,
ADD COLUMN IF NOT EXISTS weak_foot_accuracy INTEGER,
ADD COLUMN IF NOT EXISTS form INTEGER,
ADD COLUMN IF NOT EXISTS injury_resistance INTEGER;

-- Add comment
COMMENT ON TABLE player_history IS 'Complete historical record of player ownership including all player attributes from footballplayers table';
