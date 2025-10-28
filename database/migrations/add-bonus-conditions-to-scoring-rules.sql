-- Add conditional/bonus rule support to scoring_rules table
-- This allows for complex rules like "new player bonus", "streak bonus", etc.

-- Add new columns for conditional rules
ALTER TABLE scoring_rules 
ADD COLUMN IF NOT EXISTS is_bonus_rule BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS bonus_conditions JSONB,
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;

-- Create index for bonus rules
CREATE INDEX IF NOT EXISTS idx_scoring_rules_bonus ON scoring_rules(league_id, is_bonus_rule) WHERE is_bonus_rule = true;

-- Add comments
COMMENT ON COLUMN scoring_rules.is_bonus_rule IS 'Whether this is a conditional bonus rule (e.g., new player bonus, streak bonus)';
COMMENT ON COLUMN scoring_rules.bonus_conditions IS 'JSON conditions that must be met for bonus to apply: {condition_type, parameters, match_count, etc}';
COMMENT ON COLUMN scoring_rules.priority IS 'Rule priority for applying bonuses (higher = applied first)';

-- Example bonus_conditions formats:
-- New player bonus: {"condition_type": "new_player", "matches_count": 1, "since_gameweek": 5}
-- Streak bonus: {"condition_type": "streak", "event_type": "goal", "consecutive_matches": 3}
-- Milestone bonus: {"condition_type": "milestone", "event_type": "goal", "count": 10, "scope": "season"}
-- Position bonus: {"condition_type": "position", "positions": ["GK", "CB"], "event_type": "goal"}
-- Time-based bonus: {"condition_type": "time_period", "minutes": {"min": 80, "max": 90}}
-- Match-specific bonus: {"condition_type": "match_type", "types": ["derby", "final"]}

SELECT '✅ Bonus conditions columns added to scoring_rules!' as status;
