-- Create bonus_points table for tracking admin-awarded bonus points in fantasy leagues
CREATE TABLE IF NOT EXISTS bonus_points (
  id SERIAL PRIMARY KEY,
  
  -- Target (either player or team)
  target_type VARCHAR(10) NOT NULL CHECK (target_type IN ('player', 'team')),
  target_id VARCHAR(255) NOT NULL, -- real_player_id or fantasy team_id
  
  -- Points details
  points INTEGER NOT NULL,
  reason VARCHAR(500) NOT NULL, -- Heading/description for the bonus
  
  -- League tracking
  league_id VARCHAR(255) NOT NULL, -- Fantasy league ID (e.g., SSPSLFLS16)
  
  -- Audit trail
  awarded_by VARCHAR(255) NOT NULL, -- Firebase UID of admin who awarded
  awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bonus_points_target ON bonus_points(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_bonus_points_league ON bonus_points(league_id);
CREATE INDEX IF NOT EXISTS idx_bonus_points_awarded_at ON bonus_points(awarded_at DESC);

-- Comments
COMMENT ON TABLE bonus_points IS 'Stores admin-awarded bonus points for fantasy players or teams';
COMMENT ON COLUMN bonus_points.target_type IS 'Type of target: player (real_player_id) or team (fantasy team_id)';
COMMENT ON COLUMN bonus_points.target_id IS 'ID of the player or team receiving bonus points';
COMMENT ON COLUMN bonus_points.points IS 'Number of bonus points awarded (can be negative for penalties)';
COMMENT ON COLUMN bonus_points.reason IS 'Description/heading explaining why points were awarded';
COMMENT ON COLUMN bonus_points.league_id IS 'Fantasy league ID (e.g., SSPSLFLS16)';
COMMENT ON COLUMN bonus_points.awarded_by IS 'Firebase UID of the admin who awarded the points';
