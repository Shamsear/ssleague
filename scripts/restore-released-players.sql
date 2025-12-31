-- Script to restore the 22 players that were released
-- This will sync footballplayers.team_id with team_players.team_id

-- Update footballplayers table to restore team_id from team_players
UPDATE footballplayers fp
SET team_id = tp.team_id,
    updated_at = NOW()
FROM team_players tp
WHERE fp.player_id = tp.player_id
  AND fp.season_id = tp.season_id
  AND fp.team_id IS NULL
  AND tp.team_id IS NOT NULL;

-- Show the results
SELECT 
    fp.player_id,
    fp.name as player_name,
    fp.team_id as restored_team_id,
    tp.team_id as team_players_team_id
FROM footballplayers fp
INNER JOIN team_players tp ON fp.player_id = tp.player_id AND fp.season_id = tp.season_id
WHERE fp.team_id IS NOT NULL
ORDER BY fp.name;
