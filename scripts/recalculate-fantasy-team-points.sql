-- Recalculate fantasy team total points from fantasy_player_points + passive_points
-- This fixes any discrepancies between displayed points and actual player + passive points

-- Step 1: Update total_points for all teams (player points + passive team points)
UPDATE fantasy_teams ft
SET total_points = 
  COALESCE(
    (
      SELECT SUM(fpp.total_points)
      FROM fantasy_player_points fpp
      WHERE fpp.team_id = ft.team_id
    ),
    0
  ) + 
  COALESCE(ft.passive_points, 0);

-- Step 2: Recalculate ranks within each league
WITH ranked_teams AS (
  SELECT 
    team_id,
    league_id,
    ROW_NUMBER() OVER (
      PARTITION BY league_id 
      ORDER BY total_points DESC, team_name ASC
    ) as new_rank
  FROM fantasy_teams
)
UPDATE fantasy_teams ft
SET rank = rt.new_rank
FROM ranked_teams rt
WHERE ft.team_id = rt.team_id;

-- Step 3: Verify the results
SELECT 
  ft.rank,
  ft.team_name,
  ft.owner_name,
  ft.total_points,
  COUNT(DISTINCT fs.real_player_id) as player_count,
  COALESCE(SUM(fpp.total_points), 0) as player_points,
  COALESCE(ft.passive_points, 0) as passive_points,
  COALESCE(SUM(fpp.total_points), 0) + COALESCE(ft.passive_points, 0) as calculated_total
FROM fantasy_teams ft
LEFT JOIN fantasy_squad fs ON ft.team_id = fs.team_id
LEFT JOIN fantasy_player_points fpp ON fpp.team_id = ft.team_id
GROUP BY ft.team_id, ft.rank, ft.team_name, ft.owner_name, ft.total_points, ft.passive_points
ORDER BY ft.rank ASC NULLS LAST, ft.total_points DESC;
