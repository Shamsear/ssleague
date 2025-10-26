-- ============================================
-- UPDATE TOURNAMENT_SETTINGS TABLE
-- Add all missing columns for tournament-specific settings
-- ============================================

-- Add all settings columns if they don't exist
ALTER TABLE tournament_settings ADD COLUMN IF NOT EXISTS squad_size INTEGER DEFAULT 11;
ALTER TABLE tournament_settings ADD COLUMN IF NOT EXISTS tournament_system VARCHAR(50) DEFAULT 'match_round';
ALTER TABLE tournament_settings ADD COLUMN IF NOT EXISTS home_deadline_time VARCHAR(10) DEFAULT '17:00';
ALTER TABLE tournament_settings ADD COLUMN IF NOT EXISTS away_deadline_time VARCHAR(10) DEFAULT '17:00';
ALTER TABLE tournament_settings ADD COLUMN IF NOT EXISTS result_day_offset INTEGER DEFAULT 2;
ALTER TABLE tournament_settings ADD COLUMN IF NOT EXISTS result_deadline_time VARCHAR(10) DEFAULT '00:30';
ALTER TABLE tournament_settings ADD COLUMN IF NOT EXISTS has_knockout_stage BOOLEAN DEFAULT false;
ALTER TABLE tournament_settings ADD COLUMN IF NOT EXISTS playoff_teams INTEGER DEFAULT 4;
ALTER TABLE tournament_settings ADD COLUMN IF NOT EXISTS direct_semifinal_teams INTEGER DEFAULT 2;
ALTER TABLE tournament_settings ADD COLUMN IF NOT EXISTS qualification_threshold INTEGER DEFAULT 75;

-- Ensure created_at and updated_at exist
ALTER TABLE tournament_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE tournament_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add comments for documentation
COMMENT ON COLUMN tournament_settings.tournament_id IS 'Foreign key to tournaments table';
COMMENT ON COLUMN tournament_settings.squad_size IS 'Number of players per team squad';
COMMENT ON COLUMN tournament_settings.tournament_system IS 'match_round or match_day system';
COMMENT ON COLUMN tournament_settings.home_deadline_time IS 'Home team squad submission deadline (HH:MM format)';
COMMENT ON COLUMN tournament_settings.away_deadline_time IS 'Away team squad submission deadline (HH:MM format)';
COMMENT ON COLUMN tournament_settings.result_day_offset IS 'Days after match date for result submission';
COMMENT ON COLUMN tournament_settings.result_deadline_time IS 'Result submission deadline time (HH:MM format)';
COMMENT ON COLUMN tournament_settings.has_knockout_stage IS 'Whether tournament has knockout/playoff stage';
COMMENT ON COLUMN tournament_settings.playoff_teams IS 'Number of teams qualifying for playoffs';
COMMENT ON COLUMN tournament_settings.direct_semifinal_teams IS 'Number of teams going directly to semifinals';
COMMENT ON COLUMN tournament_settings.qualification_threshold IS 'Percentage of matches to complete before knockout starts';

-- Create or update trigger for auto-updating updated_at
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

-- Verification query
SELECT 
    column_name, 
    data_type, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'tournament_settings' 
ORDER BY ordinal_position;

SELECT '✅ Tournament settings table updated successfully!' as status;
