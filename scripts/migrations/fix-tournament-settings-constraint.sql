-- Fix tournament_settings unique constraint
-- The constraint should be on tournament_id, not season_id
-- This allows multiple tournaments per season

-- Drop the incorrect unique constraint on season_id
ALTER TABLE tournament_settings
DROP CONSTRAINT IF EXISTS tournament_settings_season_id_key;

-- Ensure the correct unique constraint on tournament_id exists
-- (This should already exist from the original table creation)
ALTER TABLE tournament_settings
DROP CONSTRAINT IF EXISTS tournament_settings_pkey;

ALTER TABLE tournament_settings
ADD CONSTRAINT tournament_settings_pkey PRIMARY KEY (tournament_id);

-- Verify the fix
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'tournament_settings'::regclass;
