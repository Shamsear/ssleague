-- Fix fixture IDs - team_id WITHOUT season suffix
-- Team mappings:
-- Sentinels (home) -> SSPSLT0018
-- Real Madrid / PSYCHOZ (away) -> SSPSLT0013
-- Season: SSPSLS16 (used for team_seasons lookups)

-- Update season_id
UPDATE fixtures
SET season_id = 'SSPSLS16',
    updated_at = NOW();

-- Update home_team_id (Sentinels/Titans)
UPDATE fixtures
SET home_team_id = 'SSPSLT0018',
    updated_at = NOW()
WHERE LOWER(home_team_name) LIKE '%sentinel%' OR LOWER(home_team_name) LIKE '%titan%';

-- Update home_team_id (Real Madrid/PSYCHOZ)
UPDATE fixtures
SET home_team_id = 'SSPSLT0013',
    updated_at = NOW()
WHERE LOWER(home_team_name) LIKE '%psychoz%' OR LOWER(home_team_name) LIKE '%real madrid%';

-- Update away_team_id (Real Madrid/PSYCHOZ)
UPDATE fixtures
SET away_team_id = 'SSPSLT0013',
    updated_at = NOW()
WHERE LOWER(away_team_name) LIKE '%psychoz%' OR LOWER(away_team_name) LIKE '%real madrid%';

-- Update away_team_id (Sentinels/Titans)
UPDATE fixtures
SET away_team_id = 'SSPSLT0018',
    updated_at = NOW()
WHERE LOWER(away_team_name) LIKE '%sentinel%' OR LOWER(away_team_name) LIKE '%titan%';

-- Verify the changes
SELECT 
    id, 
    season_id, 
    home_team_id, 
    home_team_name,
    away_team_id,
    away_team_name
FROM fixtures
LIMIT 5;
