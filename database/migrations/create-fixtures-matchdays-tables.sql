-- ============================================
-- CREATE FIXTURES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS fixtures (
    id VARCHAR(255) PRIMARY KEY,
    season_id VARCHAR(255) NOT NULL,
    round_number INTEGER NOT NULL,
    match_number INTEGER NOT NULL,
    home_team_id VARCHAR(255) NOT NULL,
    away_team_id VARCHAR(255) NOT NULL,
    home_team_name VARCHAR(255) NOT NULL,
    away_team_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'scheduled',
    leg VARCHAR(20) DEFAULT 'first',
    scheduled_date TIMESTAMP,
    home_score INTEGER,
    away_score INTEGER,
    result VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for fixtures
CREATE INDEX IF NOT EXISTS idx_fixtures_season ON fixtures(season_id);
CREATE INDEX IF NOT EXISTS idx_fixtures_round ON fixtures(round_number);
CREATE INDEX IF NOT EXISTS idx_fixtures_home_team ON fixtures(home_team_id);
CREATE INDEX IF NOT EXISTS idx_fixtures_away_team ON fixtures(away_team_id);
CREATE INDEX IF NOT EXISTS idx_fixtures_status ON fixtures(status);

-- ============================================
-- CREATE TOURNAMENT_SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS tournament_settings (
    id SERIAL PRIMARY KEY,
    season_id VARCHAR(255) UNIQUE NOT NULL,
    tournament_name VARCHAR(255),
    squad_size INTEGER DEFAULT 11,
    tournament_system VARCHAR(50) DEFAULT 'match_round',
    home_deadline_time VARCHAR(10) DEFAULT '17:00',
    away_deadline_time VARCHAR(10) DEFAULT '17:00',
    result_day_offset INTEGER DEFAULT 2,
    result_deadline_time VARCHAR(10) DEFAULT '00:30',
    has_knockout_stage BOOLEAN DEFAULT false,
    playoff_teams INTEGER DEFAULT 4,
    direct_semifinal_teams INTEGER DEFAULT 2,
    qualification_threshold INTEGER DEFAULT 75,
    -- legacy/extra fields
    is_two_legged BOOLEAN DEFAULT true,
    num_teams INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for tournament_settings
CREATE INDEX IF NOT EXISTS idx_tournament_settings_season ON tournament_settings(season_id);

-- ============================================
-- CREATE ROUND_DEADLINES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS round_deadlines (
    id SERIAL PRIMARY KEY,
    season_id VARCHAR(255) NOT NULL,
    round_number INTEGER NOT NULL,
    leg VARCHAR(20) DEFAULT 'first',
    scheduled_date DATE,
    home_fixture_deadline_time VARCHAR(10) DEFAULT '17:00',
    away_fixture_deadline_time VARCHAR(10) DEFAULT '17:00',
    result_entry_deadline_day_offset INTEGER DEFAULT 2,
    result_entry_deadline_time VARCHAR(10) DEFAULT '00:30',
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(season_id, round_number, leg)
);

-- Create indexes for round_deadlines
CREATE INDEX IF NOT EXISTS idx_round_deadlines_season ON round_deadlines(season_id);
CREATE INDEX IF NOT EXISTS idx_round_deadlines_round ON round_deadlines(round_number);
CREATE INDEX IF NOT EXISTS idx_round_deadlines_status ON round_deadlines(status);

-- ============================================
-- CREATE TRIGGERS
-- ============================================
-- Trigger to auto-update updated_at on fixtures
CREATE OR REPLACE FUNCTION update_fixtures_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_fixtures_updated_at ON fixtures;
CREATE TRIGGER trigger_update_fixtures_updated_at
    BEFORE UPDATE ON fixtures
    FOR EACH ROW
    EXECUTE FUNCTION update_fixtures_updated_at();

-- Trigger to auto-update updated_at on round_deadlines
CREATE OR REPLACE FUNCTION update_round_deadlines_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_round_deadlines_updated_at ON round_deadlines;
CREATE TRIGGER trigger_update_round_deadlines_updated_at
    BEFORE UPDATE ON round_deadlines
    FOR EACH ROW
    EXECUTE FUNCTION update_round_deadlines_updated_at();

-- Trigger to auto-update updated_at on tournament_settings
CREATE OR REPLACE FUNCTION update_tournament_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_tournament_settings_updated_at ON tournament_settings;
CREATE TRIGGER trigger_update_tournament_settings_updated_at
    BEFORE UPDATE ON tournament_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_tournament_settings_updated_at();

-- ============================================
-- ADD COMMENTS
-- ============================================
COMMENT ON TABLE fixtures IS 'Match fixtures for tournament rounds';
COMMENT ON TABLE round_deadlines IS 'Round schedules and deadlines for each match day';
COMMENT ON TABLE tournament_settings IS 'Tournament configuration settings per season';

-- ============================================
-- VERIFICATION
-- ============================================
SELECT 'fixtures' as table_name, COUNT(*) as row_count FROM fixtures
UNION ALL
SELECT 'round_deadlines', COUNT(*) FROM round_deadlines
UNION ALL
SELECT 'tournament_settings', COUNT(*) FROM tournament_settings;

SELECT '✅ Fixtures, round_deadlines, and tournament_settings tables created successfully!' as status;
