-- Add tournament settings columns to tournaments table
-- These settings are tournament-specific (not season-wide)

ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS squad_size INTEGER DEFAULT 11;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS tournament_system VARCHAR(50) DEFAULT 'match_round';
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS home_deadline_time VARCHAR(10) DEFAULT '17:00';
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS away_deadline_time VARCHAR(10) DEFAULT '17:00';
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS result_day_offset INTEGER DEFAULT 2;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS result_deadline_time VARCHAR(10) DEFAULT '00:30';

-- Add comments
COMMENT ON COLUMN tournaments.squad_size IS 'Number of players per team squad';
COMMENT ON COLUMN tournaments.tournament_system IS 'match_round or match_day';
COMMENT ON COLUMN tournaments.home_deadline_time IS 'Home team squad submission deadline time (HH:MM)';
COMMENT ON COLUMN tournaments.away_deadline_time IS 'Away team squad submission deadline time (HH:MM)';
COMMENT ON COLUMN tournaments.result_day_offset IS 'Days after match date for result submission';
COMMENT ON COLUMN tournaments.result_deadline_time IS 'Result submission deadline time (HH:MM)';

SELECT '✅ Tournament settings columns added successfully!' as status;
