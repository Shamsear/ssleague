-- Fix team_players table after a football player swap
-- This syncs team_players with footballplayers table

-- First, check what needs to be fixed
SELECT 
    tp.player_id,
    tp.team_id as team_players_team,
    fp.team_id as footballplayers_team,
    fp.name as player_name,
    CASE 
        WHEN tp.team_id != fp.team_id THEN 'MISMATCH - NEEDS FIX'
        ELSE 'OK'
    END as status
FROM team_players tp
JOIN footballplayers fp ON tp.player_id = fp.player_id AND tp.season_id = fp.season_id
WHERE tp.team_id != fp.team_id;

-- Fix the mismatches by updating team_players to match footballplayers
UPDATE team_players tp
SET 
    team_id = fp.team_id,
    updated_at = NOW()
FROM footballplayers fp
WHERE 
    tp.player_id = fp.player_id 
    AND tp.season_id = fp.season_id
    AND tp.team_id != fp.team_id;

-- Verify the fix
SELECT 
    tp.player_id,
    tp.team_id as team_players_team,
    fp.team_id as footballplayers_team,
    fp.name as player_name,
    'FIXED' as status
FROM team_players tp
JOIN footballplayers fp ON tp.player_id = fp.player_id AND tp.season_id = fp.season_id
WHERE tp.player_id IN (
    -- Replace these with the actual player IDs you swapped
    'PLAYER_A_ID', 'PLAYER_B_ID'
);
