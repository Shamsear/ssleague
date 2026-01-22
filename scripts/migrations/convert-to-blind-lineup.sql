-- Migration: Convert Existing Fixtures to Blind Lineup Mode
-- Tournament IDs: SSPSLS16CH (Champions League) and SSPSLS16EL (Pro League)

-- First, add the new columns if they don't exist (from main migration)
ALTER TABLE fixtures 
ADD COLUMN IF NOT EXISTS matchup_mode VARCHAR(20) DEFAULT 'manual';

ALTER TABLE fixtures
ADD COLUMN IF NOT EXISTS home_lineup_submitted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS away_lineup_submitted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS lineups_locked BOOLEAN DEFAULT false;

-- Create lineup_submissions table if it doesn't exist
CREATE TABLE IF NOT EXISTS lineup_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id VARCHAR(255) NOT NULL,
  team_id VARCHAR(255) NOT NULL,
  season_id VARCHAR(255) NOT NULL,
  tournament_id VARCHAR(255) NOT NULL,
  players JSONB NOT NULL,
  submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  is_locked BOOLEAN DEFAULT false,
  CONSTRAINT lineup_submissions_fixture_team_unique UNIQUE(fixture_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_lineup_submissions_fixture ON lineup_submissions(fixture_id);
CREATE INDEX IF NOT EXISTS idx_lineup_submissions_team ON lineup_submissions(team_id);
CREATE INDEX IF NOT EXISTS idx_lineup_submissions_tournament ON lineup_submissions(tournament_id);
CREATE INDEX IF NOT EXISTS idx_fixtures_matchup_mode ON fixtures(matchup_mode);

-- Show current status
SELECT 
  tournament_id,
  COUNT(*) as total_fixtures,
  SUM(CASE WHEN matchup_mode = 'blind_lineup' THEN 1 ELSE 0 END) as blind_lineup_count,
  SUM(CASE WHEN matchup_mode = 'manual' OR matchup_mode IS NULL THEN 1 ELSE 0 END) as manual_count
FROM fixtures
WHERE tournament_id IN ('SSPSLS16CH', 'SSPSLS16EL')
GROUP BY tournament_id;

-- Update Champions League fixtures (SSPSLS16CH)
UPDATE fixtures
SET matchup_mode = 'blind_lineup'
WHERE tournament_id = 'SSPSLS16CH'
  AND (matchup_mode IS NULL OR matchup_mode = 'manual');

-- Update Pro League fixtures (SSPSLS16EL)
UPDATE fixtures
SET matchup_mode = 'blind_lineup'
WHERE tournament_id = 'SSPSLS16EL'
  AND (matchup_mode IS NULL OR matchup_mode = 'manual');

-- Verify the conversion
SELECT 
  tournament_id,
  matchup_mode,
  COUNT(*) as fixture_count,
  SUM(CASE WHEN home_lineup_submitted THEN 1 ELSE 0 END) as home_submitted,
  SUM(CASE WHEN away_lineup_submitted THEN 1 ELSE 0 END) as away_submitted,
  SUM(CASE WHEN lineups_locked THEN 1 ELSE 0 END) as locked
FROM fixtures
WHERE tournament_id IN ('SSPSLS16CH', 'SSPSLS16EL')
GROUP BY tournament_id, matchup_mode
ORDER BY tournament_id, matchup_mode;

-- Show sample fixtures
SELECT 
  tournament_id,
  round_number,
  leg,
  home_team_name,
  away_team_name,
  matchup_mode,
  home_lineup_submitted,
  away_lineup_submitted,
  lineups_locked
FROM fixtures
WHERE tournament_id IN ('SSPSLS16CH', 'SSPSLS16EL')
ORDER BY tournament_id, round_number, match_number
LIMIT 10;
