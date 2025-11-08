-- Migration: Clear old starred_players entries that used Firebase UIDs
-- The table now expects Neon team_id (format: SSPSLT0001) instead of Firebase UID
-- Teams will need to re-star their players after this migration

-- Delete all existing entries (they have Firebase UIDs which don't match Neon team_ids)
DELETE FROM starred_players;

-- Update the comment to reflect the correct usage
COMMENT ON COLUMN starred_players.team_id IS 'Neon team_id (e.g., SSPSLT0001) - NOT Firebase UID';
