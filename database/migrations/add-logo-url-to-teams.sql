-- Add logo_url column to teams table
-- This allows teams to store their logo URL in the database

ALTER TABLE teams ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_teams_logo_url ON teams(logo_url);

-- Optional: Update existing teams with logo URLs from Firebase if needed
-- (This would need to be done via a script that reads from Firebase)
