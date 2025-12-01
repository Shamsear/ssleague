-- Add season_id column to round_players table
-- This allows direct querying of players by season without joining rounds table

ALTER TABLE round_players 
ADD COLUMN IF NOT EXISTS season_id VARCHAR(255);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_round_players_season_id ON round_players(season_id);

-- Backfill season_id from rounds table for existing records
UPDATE round_players rp
SET season_id = r.season_id
FROM rounds r
WHERE rp.round_id = r.id
AND rp.season_id IS NULL;

-- Add comment
COMMENT ON COLUMN round_players.season_id IS 'Season identifier for direct querying without joining rounds table';
