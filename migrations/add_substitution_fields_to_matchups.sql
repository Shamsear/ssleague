-- Add substitution tracking fields to matchups table
-- This allows teams to substitute players after lineup submission with penalty goals

DO $$ 
BEGIN
    -- Add home team substitution fields
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'matchups' 
        AND column_name = 'home_original_player_id'
    ) THEN
        ALTER TABLE matchups 
        ADD COLUMN home_original_player_id VARCHAR(255),
        ADD COLUMN home_original_player_name TEXT,
        ADD COLUMN home_substituted BOOLEAN DEFAULT FALSE,
        ADD COLUMN home_sub_penalty INTEGER DEFAULT 0;
        
        RAISE NOTICE 'Home substitution columns added to matchups table';
    ELSE
        RAISE NOTICE 'Home substitution columns already exist';
    END IF;
    
    -- Add away team substitution fields
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'matchups' 
        AND column_name = 'away_original_player_id'
    ) THEN
        ALTER TABLE matchups 
        ADD COLUMN away_original_player_id VARCHAR(255),
        ADD COLUMN away_original_player_name TEXT,
        ADD COLUMN away_substituted BOOLEAN DEFAULT FALSE,
        ADD COLUMN away_sub_penalty INTEGER DEFAULT 0;
        
        RAISE NOTICE 'Away substitution columns added to matchups table';
    ELSE
        RAISE NOTICE 'Away substitution columns already exist';
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN matchups.home_original_player_id IS 'Original player ID before substitution (home team)';
COMMENT ON COLUMN matchups.home_original_player_name IS 'Original player name before substitution (home team)';
COMMENT ON COLUMN matchups.home_substituted IS 'Whether home team made a substitution for this matchup';
COMMENT ON COLUMN matchups.home_sub_penalty IS 'Penalty goals awarded to away team due to home substitution (2 or 3)';

COMMENT ON COLUMN matchups.away_original_player_id IS 'Original player ID before substitution (away team)';
COMMENT ON COLUMN matchups.away_original_player_name IS 'Original player name before substitution (away team)';
COMMENT ON COLUMN matchups.away_substituted IS 'Whether away team made a substitution for this matchup';
COMMENT ON COLUMN matchups.away_sub_penalty IS 'Penalty goals awarded to home team due to away substitution (2 or 3)';
