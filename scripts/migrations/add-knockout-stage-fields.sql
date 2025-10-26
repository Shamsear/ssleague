-- Add knockout stage columns to tournaments table

-- Add knockout stage configuration columns
ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS has_knockout_stage BOOLEAN DEFAULT false;

ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS playoff_teams INTEGER DEFAULT 4;

ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS direct_semifinal_teams INTEGER DEFAULT 2;

ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS qualification_threshold INTEGER DEFAULT 75;

ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS is_pure_knockout BOOLEAN DEFAULT false;

-- Update existing tournaments to have default values
UPDATE tournaments 
SET has_knockout_stage = false,
    playoff_teams = 4,
    direct_semifinal_teams = 2,
    qualification_threshold = 75,
    is_pure_knockout = false
WHERE has_knockout_stage IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN tournaments.has_knockout_stage IS 'Whether this tournament has a knockout stage format';
COMMENT ON COLUMN tournaments.playoff_teams IS 'Number of teams in the knockout playoff bracket';
COMMENT ON COLUMN tournaments.direct_semifinal_teams IS 'Number of teams qualifying directly to semifinals';
COMMENT ON COLUMN tournaments.qualification_threshold IS 'Minimum percentage required for qualification';
COMMENT ON COLUMN tournaments.is_pure_knockout IS 'Whether this is a pure knockout tournament (no league/group stage before knockouts)';
