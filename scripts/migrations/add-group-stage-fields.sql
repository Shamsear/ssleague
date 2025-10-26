-- Add group stage columns to tournaments table

-- Add group stage configuration columns
ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS has_group_stage BOOLEAN DEFAULT false;

ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS number_of_groups INTEGER DEFAULT 4;

ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS teams_per_group INTEGER DEFAULT 4;

ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS teams_advancing_per_group INTEGER DEFAULT 2;

-- Update existing tournaments to have default values
UPDATE tournaments 
SET has_group_stage = false,
    number_of_groups = 4,
    teams_per_group = 4,
    teams_advancing_per_group = 2
WHERE has_group_stage IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN tournaments.has_group_stage IS 'Whether this tournament has a group stage format';
COMMENT ON COLUMN tournaments.number_of_groups IS 'Number of groups in the group stage (e.g., 4 for Groups A-D)';
COMMENT ON COLUMN tournaments.teams_per_group IS 'Number of teams in each group';
COMMENT ON COLUMN tournaments.teams_advancing_per_group IS 'Number of teams advancing from each group to knockout stage';
