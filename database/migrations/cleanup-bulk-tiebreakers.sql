-- Clean up bulk_tiebreakers table by removing duplicate/unused columns
-- Keep only the columns that are actually used

ALTER TABLE bulk_tiebreakers 
  DROP COLUMN IF EXISTS original_amount,
  DROP COLUMN IF EXISTS tied_teams,
  DROP COLUMN IF EXISTS duration_minutes,
  DROP COLUMN IF EXISTS winning_team_id,
  DROP COLUMN IF EXISTS winning_amount,
  DROP COLUMN IF EXISTS winning_bid,
  DROP COLUMN IF EXISTS tie_amount,
  DROP COLUMN IF EXISTS tied_team_count,
  DROP COLUMN IF EXISTS player_team;

-- Final columns remaining:
-- id, bulk_round_id, season_id, player_id, player_name, player_position
-- status, current_highest_bid, current_highest_team_id
-- start_time, last_activity_time, max_end_time, teams_remaining
-- base_price, created_at, updated_at, resolved_at

COMMENT ON TABLE bulk_tiebreakers IS 'Bulk tiebreakers - cleaned up schema with only active columns';
