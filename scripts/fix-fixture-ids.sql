-- Fix fixture IDs to match Firebase format
-- Team mappings:
-- PSYCHOZ (Real Madrid) -> SSPSLT0013_SSPSLS16
-- TITANS (Sentinels) -> SSPSLT0018_SSPSLS16
-- Season: SSPSLS16

-- Update season_id
UPDATE fixtures
SET season_id = 'SSPSLS16',
    updated_at = NOW();

-- Update home_team_id based on team names
UPDATE fixtures
SET home_team_id = 'SSPSLT0013_SSPSLS16',
    updated_at = NOW()
WHERE LOWER(home_team_name) LIKE '%psychoz%' OR LOWER(home_team_name) LIKE '%real madrid%';

UPDATE fixtures
SET home_team_id = 'SSPSLT0018_SSPSLS16',
    updated_at = NOW()
WHERE LOWER(home_team_name) LIKE '%titan%' OR LOWER(home_team_name) LIKE '%sentinel%';

-- Update away_team_id based on team names
UPDATE fixtures
SET away_team_id = 'SSPSLT0013_SSPSLS16',
    updated_at = NOW()
WHERE LOWER(away_team_name) LIKE '%psychoz%' OR LOWER(away_team_name) LIKE '%real madrid%';

UPDATE fixtures
SET away_team_id = 'SSPSLT0018_SSPSLS16',
    updated_at = NOW()
WHERE LOWER(away_team_name) LIKE '%titan%' OR LOWER(away_team_name) LIKE '%sentinel%';

-- Mark as updated
UPDATE fixtures
SET updated_at = NOW();

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
