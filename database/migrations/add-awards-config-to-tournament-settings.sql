-- ============================================
-- ADD AWARDS CONFIGURATION TO TOURNAMENT_SETTINGS
-- Enable/disable awards system per tournament
-- ============================================

-- Add awards system configuration columns
ALTER TABLE tournament_settings ADD COLUMN IF NOT EXISTS awards_enabled BOOLEAN DEFAULT true;
ALTER TABLE tournament_settings ADD COLUMN IF NOT EXISTS awards_config JSONB DEFAULT '{}'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN tournament_settings.awards_enabled IS 'Whether the awards system is enabled for this tournament';
COMMENT ON COLUMN tournament_settings.awards_config IS 'JSON configuration for awards system (award types, selection rules, etc.)';

-- Set default awards configuration for existing tournaments
UPDATE tournament_settings 
SET awards_config = '{
  "award_types": {
    "POTD": {"enabled": true, "label": "Player of the Day", "scope": "round"},
    "POTW": {"enabled": true, "label": "Player of the Week", "scope": "week"},
    "POTS": {"enabled": true, "label": "Player of the Season", "scope": "season"},
    "TOD": {"enabled": true, "label": "Team of the Day", "scope": "round"},
    "TOW": {"enabled": true, "label": "Team of the Week", "scope": "week"},
    "TOTS": {"enabled": true, "label": "Team of the Season", "scope": "season"}
  },
  "selection_rules": {
    "require_performance_stats": true,
    "require_committee_approval": false,
    "allow_duplicate_winners": false
  },
  "display_settings": {
    "show_on_public_page": true,
    "show_performance_stats": true,
    "show_selection_notes": true
  }
}'::jsonb
WHERE awards_config = '{}'::jsonb OR awards_config IS NULL;

-- Verification query
SELECT 
    tournament_id,
    awards_enabled,
    awards_config->'award_types' as award_types,
    awards_config->'selection_rules' as selection_rules
FROM tournament_settings 
WHERE awards_enabled IS NOT NULL
LIMIT 5;

SELECT '✅ Awards configuration added to tournament settings!' as status;