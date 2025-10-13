-- Player Categories Table
-- This table defines the different skill level categories for players
-- Each category has its own point configuration for wins, draws, and losses
-- based on level differences between competing players

CREATE TABLE IF NOT EXISTS player_categories (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    color VARCHAR(50) NOT NULL,
    priority INTEGER NOT NULL CHECK (priority >= 1 AND priority <= 4),
    
    -- Points for Wins (based on level difference)
    points_same_category INTEGER NOT NULL DEFAULT 8 CHECK (points_same_category >= -20 AND points_same_category <= 20),
    points_one_level_diff INTEGER NOT NULL DEFAULT 7 CHECK (points_one_level_diff >= -20 AND points_one_level_diff <= 20),
    points_two_level_diff INTEGER NOT NULL DEFAULT 6 CHECK (points_two_level_diff >= -20 AND points_two_level_diff <= 20),
    points_three_level_diff INTEGER NOT NULL DEFAULT 5 CHECK (points_three_level_diff >= -20 AND points_three_level_diff <= 20),
    
    -- Points for Draws (based on level difference)
    draw_same_category INTEGER NOT NULL DEFAULT 4 CHECK (draw_same_category >= -20 AND draw_same_category <= 20),
    draw_one_level_diff INTEGER NOT NULL DEFAULT 3 CHECK (draw_one_level_diff >= -20 AND draw_one_level_diff <= 20),
    draw_two_level_diff INTEGER NOT NULL DEFAULT 3 CHECK (draw_two_level_diff >= -20 AND draw_two_level_diff <= 20),
    draw_three_level_diff INTEGER NOT NULL DEFAULT 2 CHECK (draw_three_level_diff >= -20 AND draw_three_level_diff <= 20),
    
    -- Points for Losses (based on level difference)
    loss_same_category INTEGER NOT NULL DEFAULT 1 CHECK (loss_same_category >= -20 AND loss_same_category <= 20),
    loss_one_level_diff INTEGER NOT NULL DEFAULT 1 CHECK (loss_one_level_diff >= -20 AND loss_one_level_diff <= 20),
    loss_two_level_diff INTEGER NOT NULL DEFAULT 1 CHECK (loss_two_level_diff >= -20 AND loss_two_level_diff <= 20),
    loss_three_level_diff INTEGER NOT NULL DEFAULT 0 CHECK (loss_three_level_diff >= -20 AND loss_three_level_diff <= 20),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Indexes
    UNIQUE (priority)
);

-- Add category_id to footballplayers table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'footballplayers' AND column_name = 'category_id'
    ) THEN
        ALTER TABLE footballplayers ADD COLUMN category_id VARCHAR(255);
        ALTER TABLE footballplayers ADD COLUMN category_name VARCHAR(100);
        CREATE INDEX idx_category_id ON footballplayers(category_id);
    END IF;
END $$;

-- Trigger to update updated_at timestamp for categories
CREATE OR REPLACE FUNCTION update_category_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_player_categories_updated_at ON player_categories;
CREATE TRIGGER update_player_categories_updated_at 
    BEFORE UPDATE ON player_categories 
    FOR EACH ROW 
    EXECUTE FUNCTION update_category_updated_at();

-- Insert default categories (Red, Blue, Black, White)
INSERT INTO player_categories (
    id, name, color, priority,
    points_same_category, points_one_level_diff, points_two_level_diff, points_three_level_diff,
    draw_same_category, draw_one_level_diff, draw_two_level_diff, draw_three_level_diff,
    loss_same_category, loss_one_level_diff, loss_two_level_diff, loss_three_level_diff
) VALUES 
    ('cat_red', 'Red', 'red', 1, 8, 7, 6, 5, 4, 3, 3, 2, 1, 1, 1, 0),
    ('cat_blue', 'Blue', 'blue', 2, 8, 7, 6, 5, 4, 3, 3, 2, 1, 1, 1, 0),
    ('cat_black', 'Black', 'black', 3, 8, 7, 6, 5, 4, 3, 3, 2, 1, 1, 1, 0),
    ('cat_white', 'White', 'white', 4, 8, 7, 6, 5, 4, 3, 3, 2, 1, 1, 1, 0)
ON CONFLICT (name) DO NOTHING;

-- Comment for documentation
COMMENT ON TABLE player_categories IS 'Defines player skill categories and their point configurations for match results';
COMMENT ON COLUMN player_categories.priority IS 'Priority level (1-4), where 1 is highest. Used to calculate level differences';
COMMENT ON COLUMN player_categories.points_same_category IS 'Points awarded to winner when both players are in the same category';
COMMENT ON COLUMN player_categories.points_one_level_diff IS 'Points awarded to winner when there is 1 priority level difference';
COMMENT ON COLUMN player_categories.points_two_level_diff IS 'Points awarded to winner when there is 2 priority levels difference';
COMMENT ON COLUMN player_categories.points_three_level_diff IS 'Points awarded to winner when there is 3 or more priority levels difference';
