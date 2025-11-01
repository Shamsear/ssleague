-- Remove unique constraint on (league_id, rule_type) to allow multiple rules of same type
-- This enables having different rules for the same event type (e.g., different "win" bonuses)

-- Drop the unique constraint
ALTER TABLE fantasy_scoring_rules 
DROP CONSTRAINT IF EXISTS fantasy_scoring_rules_league_id_rule_type_key;

-- Optional: Add a composite unique constraint on (league_id, rule_type, rule_name) 
-- to prevent exact duplicates but allow multiple rules of same type with different names
ALTER TABLE fantasy_scoring_rules 
ADD CONSTRAINT fantasy_scoring_rules_league_rule_name_key 
UNIQUE (league_id, rule_type, rule_name);

SELECT '✅ Removed unique constraint on rule_type - multiple rules per type now allowed!' as status;
