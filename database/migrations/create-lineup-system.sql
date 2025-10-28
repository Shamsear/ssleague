-- ============================================
-- CREATE LINEUP SYSTEM TABLES
-- Tournament DB Migration
-- ============================================

-- ============================================
-- 1. CREATE LINEUPS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS lineups (
    id VARCHAR(255) PRIMARY KEY,
    fixture_id VARCHAR(255) NOT NULL,
    team_id VARCHAR(255) NOT NULL,
    round_number INTEGER NOT NULL,
    season_id VARCHAR(255) NOT NULL,
    tournament_id VARCHAR(255),
    
    -- Players (stored as JSONB arrays of player IDs)
    starting_xi JSONB NOT NULL DEFAULT '[]'::jsonb,
    substitutes JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Validation
    classic_player_count INTEGER NOT NULL DEFAULT 0,
    is_valid BOOLEAN DEFAULT true,
    validation_errors JSONB DEFAULT '[]'::jsonb,
    
    -- Status
    is_locked BOOLEAN DEFAULT false,
    locked_at TIMESTAMP WITH TIME ZONE,
    locked_by VARCHAR(255),
    
    -- Warning & Penalty System
    warning_given BOOLEAN DEFAULT false,
    warning_given_at TIMESTAMP WITH TIME ZONE,
    selected_by_opponent BOOLEAN DEFAULT false,
    opponent_selector_id VARCHAR(255),
    opponent_selected_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    submitted_by VARCHAR(255) NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT lineups_fixture_fk FOREIGN KEY (fixture_id) REFERENCES fixtures(id) ON DELETE CASCADE,
    CONSTRAINT lineups_unique_per_team UNIQUE(fixture_id, team_id),
    CONSTRAINT lineups_starting_xi_size CHECK (jsonb_array_length(starting_xi) <= 5),
    CONSTRAINT lineups_substitutes_size CHECK (jsonb_array_length(substitutes) <= 2),
    CONSTRAINT lineups_classic_count CHECK (classic_player_count >= 0)
);

-- Create indexes for lineups
CREATE INDEX IF NOT EXISTS idx_lineups_fixture ON lineups(fixture_id);
CREATE INDEX IF NOT EXISTS idx_lineups_team ON lineups(team_id);
CREATE INDEX IF NOT EXISTS idx_lineups_round ON lineups(round_number);
CREATE INDEX IF NOT EXISTS idx_lineups_season ON lineups(season_id);
CREATE INDEX IF NOT EXISTS idx_lineups_locked ON lineups(is_locked);
CREATE INDEX IF NOT EXISTS idx_lineups_valid ON lineups(is_valid);
CREATE INDEX IF NOT EXISTS idx_lineups_warning ON lineups(warning_given);

COMMENT ON TABLE lineups IS 'Team lineups for fixtures - 5 starting players + 2 substitutes';
COMMENT ON COLUMN lineups.starting_xi IS 'Array of 5 player IDs in starting lineup';
COMMENT ON COLUMN lineups.substitutes IS 'Array of 2 player IDs as substitutes';
COMMENT ON COLUMN lineups.classic_player_count IS 'Number of classic category players (min 2 required)';
COMMENT ON COLUMN lineups.is_locked IS 'True after deadline (1 hour after round starts)';
COMMENT ON COLUMN lineups.selected_by_opponent IS 'True if opponent selected lineup as penalty';

-- ============================================
-- 2. CREATE LINEUP_SUBSTITUTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS lineup_substitutions (
    id SERIAL PRIMARY KEY,
    lineup_id VARCHAR(255) NOT NULL,
    fixture_id VARCHAR(255) NOT NULL,
    team_id VARCHAR(255) NOT NULL,
    
    -- Swap details
    player_out VARCHAR(255) NOT NULL,
    player_out_name VARCHAR(255),
    player_in VARCHAR(255) NOT NULL,
    player_in_name VARCHAR(255),
    
    -- Timing
    made_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    made_by VARCHAR(255) NOT NULL,
    made_by_name VARCHAR(255),
    
    -- Metadata
    notes TEXT,
    
    -- Constraints
    CONSTRAINT lineup_subs_lineup_fk FOREIGN KEY (lineup_id) REFERENCES lineups(id) ON DELETE CASCADE,
    CONSTRAINT lineup_subs_fixture_fk FOREIGN KEY (fixture_id) REFERENCES fixtures(id) ON DELETE CASCADE
);

-- Create indexes for lineup_substitutions
CREATE INDEX IF NOT EXISTS idx_lineup_subs_lineup ON lineup_substitutions(lineup_id);
CREATE INDEX IF NOT EXISTS idx_lineup_subs_fixture ON lineup_substitutions(fixture_id);
CREATE INDEX IF NOT EXISTS idx_lineup_subs_team ON lineup_substitutions(team_id);
CREATE INDEX IF NOT EXISTS idx_lineup_subs_player_out ON lineup_substitutions(player_out);
CREATE INDEX IF NOT EXISTS idx_lineup_subs_player_in ON lineup_substitutions(player_in);

COMMENT ON TABLE lineup_substitutions IS 'Track all substitutions made during matches';
COMMENT ON COLUMN lineup_substitutions.player_out IS 'Player ID who was substituted out';
COMMENT ON COLUMN lineup_substitutions.player_in IS 'Player ID who was substituted in';

-- ============================================
-- 3. ALTER REALPLAYERSTATS TABLE
-- Add participation tracking columns
-- ============================================
DO $$ 
BEGIN
    -- Add participation_type column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'realplayerstats' 
        AND column_name = 'participation_type'
    ) THEN
        ALTER TABLE realplayerstats 
        ADD COLUMN participation_type VARCHAR(20) 
        CHECK (participation_type IN ('started', 'subbed_in', 'subbed_out', 'unused_sub'));
        
        COMMENT ON COLUMN realplayerstats.participation_type IS 
            'How player participated: started, subbed_in, subbed_out, unused_sub';
    END IF;
    
    -- Add match_played column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'realplayerstats' 
        AND column_name = 'match_played'
    ) THEN
        ALTER TABLE realplayerstats 
        ADD COLUMN match_played BOOLEAN DEFAULT false;
        
        COMMENT ON COLUMN realplayerstats.match_played IS 
            'True only if participation_type is started or subbed_in';
    END IF;
    
    -- Add lineup_id reference if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'realplayerstats' 
        AND column_name = 'lineup_id'
    ) THEN
        ALTER TABLE realplayerstats 
        ADD COLUMN lineup_id VARCHAR(255);
        
        COMMENT ON COLUMN realplayerstats.lineup_id IS 
            'Reference to lineup used for this match';
    END IF;
END $$;

-- Create index on participation columns
CREATE INDEX IF NOT EXISTS idx_realplayerstats_participation ON realplayerstats(participation_type);
CREATE INDEX IF NOT EXISTS idx_realplayerstats_match_played ON realplayerstats(match_played);

-- ============================================
-- 4. CREATE TRIGGERS
-- ============================================

-- Trigger to auto-update updated_at on lineups
CREATE OR REPLACE FUNCTION update_lineups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_lineups_updated_at ON lineups;
CREATE TRIGGER trigger_update_lineups_updated_at
    BEFORE UPDATE ON lineups
    FOR EACH ROW
    EXECUTE FUNCTION update_lineups_updated_at();

-- ============================================
-- 5. HELPER FUNCTIONS
-- ============================================

-- Function to validate lineup has minimum classic players
CREATE OR REPLACE FUNCTION validate_lineup_classic_count(
    p_starting_xi JSONB,
    p_substitutes JSONB,
    p_season_id VARCHAR
) RETURNS INTEGER AS $$
DECLARE
    v_classic_count INTEGER := 0;
    v_player_id TEXT;
BEGIN
    -- Count classic players in starting XI
    FOR v_player_id IN SELECT jsonb_array_elements_text(p_starting_xi)
    LOOP
        SELECT COUNT(*) INTO v_classic_count
        FROM player_seasons
        WHERE player_id = v_player_id
        AND season_id = p_season_id
        AND category = 'classic';
        
        IF v_classic_count > 0 THEN
            v_classic_count := v_classic_count + 1;
        END IF;
    END LOOP;
    
    -- Count classic players in substitutes
    FOR v_player_id IN SELECT jsonb_array_elements_text(p_substitutes)
    LOOP
        SELECT COUNT(*) INTO v_classic_count
        FROM player_seasons
        WHERE player_id = v_player_id
        AND season_id = p_season_id
        AND category = 'classic';
        
        IF v_classic_count > 0 THEN
            v_classic_count := v_classic_count + 1;
        END IF;
    END LOOP;
    
    RETURN v_classic_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_lineup_classic_count IS 
    'Count total classic category players in a lineup (starting XI + subs)';

-- ============================================
-- 6. VERIFICATION
-- ============================================
SELECT 'lineups' as table_name, COUNT(*) as row_count FROM lineups
UNION ALL
SELECT 'lineup_substitutions', COUNT(*) FROM lineup_substitutions;

SELECT '✅ Lineup system tables created successfully!' as status;
SELECT '📋 Tables: lineups, lineup_substitutions' as info;
SELECT '✏️ Modified: realplayerstats (added participation_type, match_played)' as modified;
