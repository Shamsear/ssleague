-- ============================================================================
-- CREATE PLAYER_AWARDS TABLE
-- Execute this SQL directly in your Neon database console
-- ============================================================================

-- Drop table if you need to recreate (uncomment if needed)
-- DROP TABLE IF EXISTS player_awards CASCADE;

-- Create player_awards table
CREATE TABLE IF NOT EXISTS player_awards (
    id SERIAL PRIMARY KEY,
    player_id VARCHAR(255) NOT NULL,
    player_name VARCHAR(255) NOT NULL,
    season_id INTEGER NOT NULL,
    award_name VARCHAR(255) NOT NULL,
    award_position VARCHAR(100),
    award_value NUMERIC(10, 2),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraint: One award per player per season
    CONSTRAINT unique_player_season_award UNIQUE (player_id, season_id, award_name)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_player_awards_player_id ON player_awards(player_id);
CREATE INDEX IF NOT EXISTS idx_player_awards_season_id ON player_awards(season_id);
CREATE INDEX IF NOT EXISTS idx_player_awards_player_season ON player_awards(player_id, season_id);

-- Verify table creation
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'player_awards'
ORDER BY ordinal_position;

-- Show indexes
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'player_awards';

-- Success message
SELECT '✅ player_awards table created successfully!' AS status;
