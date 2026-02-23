-- Add display_order column to awards table
ALTER TABLE awards ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Add display_order column to player_awards table
ALTER TABLE player_awards ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Add display_order column to team_trophies table
ALTER TABLE team_trophies ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Create indexes for better sorting performance
CREATE INDEX IF NOT EXISTS idx_awards_display_order ON awards(season_id, display_order DESC, selected_at DESC);
CREATE INDEX IF NOT EXISTS idx_player_awards_display_order ON player_awards(season_id, display_order DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_trophies_display_order ON team_trophies(season_id, display_order DESC, awarded_at DESC);
