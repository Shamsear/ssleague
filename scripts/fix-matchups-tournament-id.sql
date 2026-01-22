-- Fix existing matchups that don't have tournament_id
-- This updates all matchups to include the tournament_id from their associated fixture

UPDATE matchups m
SET tournament_id = f.tournament_id
FROM fixtures f
WHERE m.fixture_id = f.id
  AND m.tournament_id IS NULL;

-- Verify the fix
SELECT 
  COUNT(*) FILTER (WHERE tournament_id IS NOT NULL) as with_tournament_id,
  COUNT(*) FILTER (WHERE tournament_id IS NULL) as without_tournament_id,
  COUNT(*) as total
FROM matchups;
