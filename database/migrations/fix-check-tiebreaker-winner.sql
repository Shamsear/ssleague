-- Drop all existing versions of the function
DROP FUNCTION IF EXISTS check_tiebreaker_winner(INTEGER);
DROP FUNCTION IF EXISTS check_tiebreaker_winner(TEXT);
DROP FUNCTION IF EXISTS check_tiebreaker_winner(VARCHAR);

-- Create the check_tiebreaker_winner function
-- Accepts VARCHAR tiebreaker_id (handles both integer and string IDs)
CREATE OR REPLACE FUNCTION check_tiebreaker_winner(tiebreaker_id_param VARCHAR)
RETURNS TABLE(
    teams_left INTEGER,
    winner_team_id VARCHAR(255),
    winner_bid INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as teams_left,
        MAX(CASE WHEN status = 'active' THEN team_id END)::VARCHAR(255) as winner_team_id,
        MAX(CASE WHEN status = 'active' THEN current_bid END)::INTEGER as winner_bid
    FROM bulk_tiebreaker_teams
    WHERE tiebreaker_id = tiebreaker_id_param
    AND status = 'active';
END;
$$ LANGUAGE plpgsql;
