-- Recalculate fantasy_squad player total_points from fantasy_player_points
-- This ensures individual player totals match their actual earned points

-- Step 1: Update total_points for all players in fantasy_squad
UPDATE fantasy_squad fs
SET total_points = COALESCE(
  (
    SELECT SUM(fpp.total_points)
    FROM fantasy_player_points fpp
    WHERE fpp.team_id = fs.team_id
      AND fpp.real_player_id = fs.real_player_id
  ),
  0
);

-- Step 2: Verify the results - show players with their calculated points
SELECT 
  ft.team_name,
  fs.player_name,
  fs.total_points as squad_total,
  COALESCE(
    (
      SELECT SUM(fpp.total_points)
      FROM fantasy_player_points fpp
      WHERE fpp.team_id = fs.team_id
        AND fpp.real_player_id = fs.real_player_id
    ),
    0
  ) as calculated_total,
  fs.is_captain,
  fs.is_vice_captain
FROM fantasy_squad fs
JOIN fantasy_teams ft ON fs.team_id = ft.team_id
ORDER BY ft.team_name, fs.total_points DESC;
