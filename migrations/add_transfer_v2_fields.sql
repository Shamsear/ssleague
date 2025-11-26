-- Migration: Add Transfer V2 Fields
-- Description: Adds star_rating, points, salary_per_match, and transfer_count columns
--              to support the enhanced player transfer and swap system
-- Date: 2025-11-26
-- Requirements: 4.5, 5.5

-- ============================================================================
-- FOOTBALLPLAYERS TABLE UPDATES
-- ============================================================================

-- Add star_rating column (3-10 stars, default 5)
ALTER TABLE footballplayers 
ADD COLUMN IF NOT EXISTS star_rating INTEGER DEFAULT 5 
CHECK (star_rating >= 3 AND star_rating <= 10);

-- Add points column (used to calculate star rating upgrades)
ALTER TABLE footballplayers 
ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 180;

-- Add salary_per_match column (calculated based on player value)
ALTER TABLE footballplayers 
ADD COLUMN IF NOT EXISTS salary_per_match DECIMAL(10,2) DEFAULT 0.00;

-- Add transfer_count column (tracks number of times player has been transferred)
ALTER TABLE footballplayers 
ADD COLUMN IF NOT EXISTS transfer_count INTEGER DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN footballplayers.star_rating IS 'Player star rating (3-10), affects transfer value multiplier';
COMMENT ON COLUMN footballplayers.points IS 'Points accumulated by player, determines star rating upgrades';
COMMENT ON COLUMN footballplayers.salary_per_match IS 'Calculated salary per match based on player value (0.3% for football players)';
COMMENT ON COLUMN footballplayers.transfer_count IS 'Number of times this player has been transferred';

-- ============================================================================
-- PLAYER_SEASONS TABLE UPDATES (if exists)
-- ============================================================================
-- Note: This table is for real players. If it doesn't exist yet, these
-- statements will be skipped gracefully.

DO $$ 
BEGIN
    -- Check if player_seasons table exists
    IF EXISTS (SELECT FROM information_schema.tables 
               WHERE table_name = 'player_seasons') THEN
        
        -- Add star_rating column
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'player_seasons' 
                      AND column_name = 'star_rating') THEN
            ALTER TABLE player_seasons 
            ADD COLUMN star_rating INTEGER DEFAULT 5 
            CHECK (star_rating >= 3 AND star_rating <= 10);
            
            COMMENT ON COLUMN player_seasons.star_rating IS 'Player star rating (3-10), affects transfer value multiplier';
        END IF;
        
        -- Add points column
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'player_seasons' 
                      AND column_name = 'points') THEN
            ALTER TABLE player_seasons 
            ADD COLUMN points INTEGER DEFAULT 180;
            
            COMMENT ON COLUMN player_seasons.points IS 'Points accumulated by player, determines star rating upgrades';
        END IF;
        
        -- Add salary_per_match column
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'player_seasons' 
                      AND column_name = 'salary_per_match') THEN
            ALTER TABLE player_seasons 
            ADD COLUMN salary_per_match DECIMAL(10,2) DEFAULT 0.00;
            
            COMMENT ON COLUMN player_seasons.salary_per_match IS 'Calculated salary per match based on player value (0.7% for real players)';
        END IF;
        
        -- Add transfer_count column
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'player_seasons' 
                      AND column_name = 'transfer_count') THEN
            ALTER TABLE player_seasons 
            ADD COLUMN transfer_count INTEGER DEFAULT 0;
            
            COMMENT ON COLUMN player_seasons.transfer_count IS 'Number of times this player has been transferred';
        END IF;
        
        RAISE NOTICE 'player_seasons table updated successfully';
    ELSE
        RAISE NOTICE 'player_seasons table does not exist, skipping';
    END IF;
END $$;

-- ============================================================================
-- INDEXES FOR EFFICIENT QUERIES
-- ============================================================================

-- Index for star_rating queries (used in transfer calculations)
CREATE INDEX IF NOT EXISTS idx_footballplayers_star_rating 
ON footballplayers(star_rating);

-- Index for points queries (used in upgrade calculations)
CREATE INDEX IF NOT EXISTS idx_footballplayers_points 
ON footballplayers(points);

-- Index for transfer_count queries (used in analytics)
CREATE INDEX IF NOT EXISTS idx_footballplayers_transfer_count 
ON footballplayers(transfer_count);

-- Composite index for team and season queries with star rating
CREATE INDEX IF NOT EXISTS idx_footballplayers_team_season_star 
ON footballplayers(team_id, season_id, star_rating) 
WHERE team_id IS NOT NULL AND season_id IS NOT NULL;

-- Index for salary calculations
CREATE INDEX IF NOT EXISTS idx_footballplayers_salary 
ON footballplayers(salary_per_match) 
WHERE salary_per_match > 0;

-- Add indexes for player_seasons if table exists
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables 
               WHERE table_name = 'player_seasons') THEN
        
        -- Index for star_rating queries
        CREATE INDEX IF NOT EXISTS idx_player_seasons_star_rating 
        ON player_seasons(star_rating);
        
        -- Index for points queries
        CREATE INDEX IF NOT EXISTS idx_player_seasons_points 
        ON player_seasons(points);
        
        -- Index for transfer_count queries
        CREATE INDEX IF NOT EXISTS idx_player_seasons_transfer_count 
        ON player_seasons(transfer_count);
        
        -- Composite index for team and season queries with star rating
        CREATE INDEX IF NOT EXISTS idx_player_seasons_team_season_star 
        ON player_seasons(team_id, season_id, star_rating) 
        WHERE team_id IS NOT NULL AND season_id IS NOT NULL;
        
        -- Index for salary calculations
        CREATE INDEX IF NOT EXISTS idx_player_seasons_salary 
        ON player_seasons(salary_per_match) 
        WHERE salary_per_match > 0;
        
        RAISE NOTICE 'player_seasons indexes created successfully';
    END IF;
END $$;

-- ============================================================================
-- ANALYZE TABLES
-- ============================================================================

-- Update table statistics for query optimization
ANALYZE footballplayers;

DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables 
               WHERE table_name = 'player_seasons') THEN
        ANALYZE player_seasons;
    END IF;
END $$;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify footballplayers columns
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'footballplayers' 
AND column_name IN ('star_rating', 'points', 'salary_per_match', 'transfer_count')
ORDER BY column_name;

-- Verify player_seasons columns (if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables 
               WHERE table_name = 'player_seasons') THEN
        RAISE NOTICE 'Verifying player_seasons columns...';
        PERFORM column_name, data_type, column_default, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'player_seasons' 
        AND column_name IN ('star_rating', 'points', 'salary_per_match', 'transfer_count');
    END IF;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

SELECT 'Migration add_transfer_v2_fields.sql completed successfully!' AS status;
