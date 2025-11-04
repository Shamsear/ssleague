-- ============================================
-- Add season_id column to round_bids and round_players tables
-- ============================================
-- This migration adds the season_id column to track which season each bid/player belongs to

-- Add season_id column to round_bids (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'round_bids' AND column_name = 'season_id'
  ) THEN
    ALTER TABLE round_bids 
    ADD COLUMN season_id VARCHAR(50);
    
    COMMENT ON COLUMN round_bids.season_id IS 'Season identifier for the bid';
    
    -- Create index for season_id
    CREATE INDEX IF NOT EXISTS idx_round_bids_season ON round_bids(season_id);
    
    -- Backfill season_id from rounds table for existing records
    UPDATE round_bids rb
    SET season_id = r.season_id
    FROM rounds r
    WHERE rb.round_id = r.id
    AND rb.season_id IS NULL;
    
    RAISE NOTICE 'Added season_id column to round_bids table';
  ELSE
    RAISE NOTICE 'season_id column already exists in round_bids table';
  END IF;
END $$;

-- Add season_id column to round_players (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'round_players' AND column_name = 'season_id'
  ) THEN
    ALTER TABLE round_players 
    ADD COLUMN season_id VARCHAR(50);
    
    COMMENT ON COLUMN round_players.season_id IS 'Season identifier for the player assignment';
    
    -- Create index for season_id
    CREATE INDEX IF NOT EXISTS idx_round_players_season ON round_players(season_id);
    
    -- Backfill season_id from rounds table for existing records
    UPDATE round_players rp
    SET season_id = r.season_id
    FROM rounds r
    WHERE rp.round_id = r.id
    AND rp.season_id IS NULL;
    
    RAISE NOTICE 'Added season_id column to round_players table';
  ELSE
    RAISE NOTICE 'season_id column already exists in round_players table';
  END IF;
END $$;

-- Verify the changes
SELECT 
  'round_bids' as table_name,
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'round_bids'
AND column_name = 'season_id'

UNION ALL

SELECT 
  'round_players' as table_name,
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'round_players'
AND column_name = 'season_id';
