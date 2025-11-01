-- Add applies_to column to fantasy_scoring_rules table
-- This field indicates whether the rule applies to players, teams, or both

ALTER TABLE fantasy_scoring_rules 
ADD COLUMN IF NOT EXISTS applies_to VARCHAR(50) DEFAULT 'player';

-- Update existing rules to have default value
UPDATE fantasy_scoring_rules 
SET applies_to = 'player' 
WHERE applies_to IS NULL;

SELECT '✅ Added applies_to column to fantasy_scoring_rules!' as status;
