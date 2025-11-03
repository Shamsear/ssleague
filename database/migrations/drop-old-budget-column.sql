-- Remove old budget column from teams table
-- We're using football_budget instead

ALTER TABLE teams DROP COLUMN IF EXISTS budget;
