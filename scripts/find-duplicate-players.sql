-- Find duplicate players with same name and nationality
-- Shows all duplicates with their position, position_group, and other details

SELECT 
    name,
    nationality,
    COUNT(*) as duplicate_count,
    STRING_AGG(DISTINCT position, ', ' ORDER BY position) as positions,
    STRING_AGG(DISTINCT position_group, ', ' ORDER BY position_group) as position_groups,
    ARRAY_AGG(
        json_build_object(
            'id', id,
            'player_id', player_id,
            'position', position,
            'position_group', position_group,
            'overall_rating', overall_rating,
            'team_id', team_id,
            'team_name', team_name,
            'is_auction_eligible', is_auction_eligible,
            'playing_style', playing_style
        ) ORDER BY overall_rating DESC NULLS LAST, id
    ) as player_details
FROM footballplayers
GROUP BY name, nationality
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC, name;

-- Alternative: Show duplicates in a more readable row format
-- Uncomment to use this version instead:

/*
SELECT 
    fp.id,
    fp.player_id,
    fp.name,
    fp.nationality,
    fp.position,
    fp.position_group,
    fp.overall_rating,
    fp.team_id,
    fp.team_name,
    fp.is_auction_eligible,
    fp.playing_style,
    dup.duplicate_count
FROM footballplayers fp
INNER JOIN (
    SELECT name, nationality, COUNT(*) as duplicate_count
    FROM footballplayers
    GROUP BY name, nationality
    HAVING COUNT(*) > 1
) dup ON fp.name = dup.name AND fp.nationality = dup.nationality
ORDER BY fp.name, fp.nationality, fp.overall_rating DESC NULLS LAST;
*/

-- To delete duplicates (keeping the one with highest overall_rating):
-- CAUTION: Review the results above before running this!

/*
DELETE FROM footballplayers
WHERE id IN (
    SELECT id
    FROM (
        SELECT 
            id,
            ROW_NUMBER() OVER (
                PARTITION BY name, nationality 
                ORDER BY 
                    overall_rating DESC NULLS LAST,
                    CASE WHEN team_id IS NOT NULL THEN 0 ELSE 1 END, -- Keep assigned players
                    id
            ) as rn
        FROM footballplayers
    ) ranked
    WHERE rn > 1
);
*/
