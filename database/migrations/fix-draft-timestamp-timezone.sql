-- Fix draft period timestamp columns to use TIMESTAMPTZ (timestamp with timezone)
-- This prevents PostgreSQL from applying session timezone conversions

-- Change column types to TIMESTAMPTZ
ALTER TABLE fantasy_leagues 
ALTER COLUMN draft_opens_at TYPE TIMESTAMPTZ USING draft_opens_at AT TIME ZONE 'UTC',
ALTER COLUMN draft_closes_at TYPE TIMESTAMPTZ USING draft_closes_at AT TIME ZONE 'UTC';

-- Update existing data to ensure it's in UTC
UPDATE fantasy_leagues
SET draft_opens_at = draft_opens_at AT TIME ZONE 'UTC'
WHERE draft_opens_at IS NOT NULL;

UPDATE fantasy_leagues
SET draft_closes_at = draft_closes_at AT TIME ZONE 'UTC'
WHERE draft_closes_at IS NOT NULL;

-- Add comments
COMMENT ON COLUMN fantasy_leagues.draft_opens_at IS 'When the draft period opens (UTC timezone)';
COMMENT ON COLUMN fantasy_leagues.draft_closes_at IS 'When the draft period closes (UTC timezone)';

SELECT '✅ Draft timestamp columns fixed to use TIMESTAMPTZ!' as status;
