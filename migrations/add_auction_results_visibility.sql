-- Add column to control auction results visibility for teams
-- This allows admins to hide/show auction results from team users

ALTER TABLE auction_settings 
ADD COLUMN IF NOT EXISTS show_auction_results_to_teams BOOLEAN DEFAULT FALSE;

-- Set default to false (hidden) for existing records
UPDATE auction_settings 
SET show_auction_results_to_teams = FALSE 
WHERE show_auction_results_to_teams IS NULL;

-- Add comment
COMMENT ON COLUMN auction_settings.show_auction_results_to_teams IS 
'Controls whether team users can view auction results. Committee/admin can always view.';
