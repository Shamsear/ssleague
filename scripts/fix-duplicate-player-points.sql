-- Script to identify and fix duplicate player points in player_seasons
-- This happens when results are submitted multiple times for the same fixture

-- Step 1: Identify players with duplicate points
-- We'll look for players whose processed_fixtures array has duplicates
-- or whose stats seem inflated compared to their actual fixture performances

-- First, let's see which fixtures have been processed multiple times
SELECT 
    ps.id,
    ps.player_id,
    ps.season_id,
    ps.total_points,
    ps.goals_scored,
    ps.assists,
    ps.clean_sheets,
    ps.processed_fixtures,
    array_length(ps.processed_fixtures, 1) as fixtures_count,
    -- Count actual unique fixtures
    (SELECT COUNT(DISTINCT unnest) FROM unnest(ps.processed_fixtures)) as unique_fixtures_count
FROM player_seasons ps
WHERE ps.processed_fixtures IS NOT NULL
    AND array_length(ps.processed_fixtures, 1) > 0
    -- Find cases where there are duplicate fixture IDs in the array
    AND array_length(ps.processed_fixtures, 1) != (SELECT COUNT(DISTINCT unnest) FROM unnest(ps.processed_fixtures))
ORDER BY ps.total_points DESC;

-- Step 2: For each affected player, recalculate their stats from scratch
-- This query will show what the correct stats should be

WITH player_actual_stats AS (
    SELECT 
        rp.player_id,
        rp.season_id,
        COUNT(DISTINCT rp.fixture_id) as actual_fixtures_played,
        SUM(rp.points) as actual_total_points,
        SUM(rp.goals_scored) as actual_goals,
        SUM(rp.assists) as actual_assists,
        SUM(CASE WHEN rp.goals_conceded = 0 THEN 1 ELSE 0 END) as actual_clean_sheets,
        SUM(rp.goals_conceded) as actual_goals_conceded,
        SUM(rp.yellow_cards) as actual_yellow_cards,
        SUM(rp.red_cards) as actual_red_cards,
        array_agg(DISTINCT rp.fixture_id ORDER BY rp.fixture_id) as actual_fixture_ids
    FROM round_players rp
    WHERE rp.points IS NOT NULL
    GROUP BY rp.player_id, rp.season_id
)
SELECT 
    ps.id,
    ps.player_id,
    ps.season_id,
    ps.total_points as current_points,
    pas.actual_total_points as correct_points,
    ps.total_points - pas.actual_total_points as points_difference,
    ps.goals_scored as current_goals,
    pas.actual_goals as correct_goals,
    ps.assists as current_assists,
    pas.actual_assists as correct_assists,
    ps.clean_sheets as current_clean_sheets,
    pas.actual_clean_sheets as correct_clean_sheets,
    array_length(ps.processed_fixtures, 1) as recorded_fixtures,
    pas.actual_fixtures_played as actual_fixtures
FROM player_seasons ps
JOIN player_actual_stats pas ON ps.player_id = pas.player_id AND ps.season_id = pas.season_id
WHERE ps.total_points != pas.actual_total_points
    OR ps.goals_scored != pas.actual_goals
    OR ps.assists != pas.actual_assists
ORDER BY points_difference DESC;

-- Step 3: Fix the duplicates by recalculating from round_players
-- UNCOMMENT THE FOLLOWING TO APPLY THE FIX:

/*
WITH player_actual_stats AS (
    SELECT 
        rp.player_id,
        rp.season_id,
        COUNT(DISTINCT rp.fixture_id) as fixtures_played,
        SUM(rp.points) as total_points,
        SUM(rp.goals_scored) as goals_scored,
        SUM(rp.assists) as assists,
        SUM(CASE WHEN rp.goals_conceded = 0 THEN 1 ELSE 0 END) as clean_sheets,
        SUM(rp.goals_conceded) as goals_conceded,
        SUM(rp.yellow_cards) as yellow_cards,
        SUM(rp.red_cards) as red_cards,
        array_agg(DISTINCT rp.fixture_id ORDER BY rp.fixture_id) as fixture_ids
    FROM round_players rp
    WHERE rp.points IS NOT NULL
    GROUP BY rp.player_id, rp.season_id
)
UPDATE player_seasons ps
SET 
    total_points = pas.total_points,
    goals_scored = pas.goals_scored,
    assists = pas.assists,
    clean_sheets = pas.clean_sheets,
    goals_conceded = pas.goals_conceded,
    yellow_cards = pas.yellow_cards,
    red_cards = pas.red_cards,
    processed_fixtures = pas.fixture_ids,
    updated_at = NOW()
FROM player_actual_stats pas
WHERE ps.player_id = pas.player_id 
    AND ps.season_id = pas.season_id
    AND (
        ps.total_points != pas.total_points
        OR ps.goals_scored != pas.goals_scored
        OR ps.assists != pas.assists
    );
*/

-- Step 4: Verify the fix
-- Run this after applying the fix to confirm all stats are correct
/*
WITH player_actual_stats AS (
    SELECT 
        rp.player_id,
        rp.season_id,
        SUM(rp.points) as actual_total_points
    FROM round_players rp
    WHERE rp.points IS NOT NULL
    GROUP BY rp.player_id, rp.season_id
)
SELECT 
    COUNT(*) as mismatched_players
FROM player_seasons ps
JOIN player_actual_stats pas ON ps.player_id = pas.player_id AND ps.season_id = pas.season_id
WHERE ps.total_points != pas.actual_total_points;
*/
