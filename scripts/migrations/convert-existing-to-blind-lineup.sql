-- Migration: Convert Existing Fixtures to Blind Lineup Mode
-- Date: 2026-01-21
-- Purpose: Update Pro League and Champions League fixtures to use blind_lineup mode

-- First, let's see what we're working with
-- SELECT tournament_name, COUNT(*) as fixture_count
-- FROM fixtures f
-- JOIN tournaments t ON f.tournament_id = t.id
-- WHERE t.tournament_name IN ('Pro League', 'Champions League')
-- GROUP BY tournament_name;

-- Update Pro League fixtures to blind_lineup mode
UPDATE fixtures
SET matchup_mode = 'blind_lineup'
WHERE tournament_id IN (
  SELECT id FROM tournaments 
  WHERE tournament_name = 'Pro League'
);

-- Update Champions League fixtures to blind_lineup mode
UPDATE fixtures
SET matchup_mode = 'blind_lineup'
WHERE tournament_id IN (
  SELECT id FROM tournaments 
  WHERE tournament_name = 'Champions League'
);

-- Verify the update
SELECT 
  t.tournament_name,
  f.matchup_mode,
  COUNT(*) as fixture_count
FROM fixtures f
JOIN tournaments t ON f.tournament_id = t.id
WHERE t.tournament_name IN ('Pro League', 'Champions League')
GROUP BY t.tournament_name, f.matchup_mode
ORDER BY t.tournament_name, f.matchup_mode;

-- Show sample fixtures
SELECT 
  t.tournament_name,
  f.round_number,
  f.leg,
  f.home_team_name,
  f.away_team_name,
  f.matchup_mode,
  f.home_lineup_submitted,
  f.away_lineup_submitted,
  f.lineups_locked
FROM fixtures f
JOIN tournaments t ON f.tournament_id = t.id
WHERE t.tournament_name IN ('Pro League', 'Champions League')
ORDER BY t.tournament_name, f.round_number, f.match_number
LIMIT 10;
