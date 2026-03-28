-- Fantasy League Revamp - Phase 4: Engagement Features
-- Migration: Create engagement tables
-- Date: 2026-02-26

-- ============================================================================
-- PLAYER FORM & ANALYTICS
-- ============================================================================

-- Add form tracking columns to existing fantasy_players table
ALTER TABLE fantasy_players
ADD COLUMN IF NOT EXISTS form_status VARCHAR(20) DEFAULT 'steady',
ADD COLUMN IF NOT EXISTS form_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_5_games_avg DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS form_multiplier DECIMAL(3,2) DEFAULT 1.00,
ADD COLUMN IF NOT EXISTS games_played INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ownership_percentage DECIMAL(5,2) DEFAULT 0;

COMMENT ON COLUMN fantasy_players.form_status IS 'Player form: fire, hot, steady, cold, frozen';
COMMENT ON COLUMN fantasy_players.form_multiplier IS 'Points multiplier based on form (0.85 - 1.15)';

-- ============================================================================
-- CREATE fixture_difficulty_ratings TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS fixture_difficulty_ratings (
  id SERIAL PRIMARY KEY,
  rating_id VARCHAR(100) UNIQUE NOT NULL,
  league_id VARCHAR(100) NOT NULL,
  round_id VARCHAR(100) NOT NULL,
  team_id VARCHAR(100) NOT NULL,
  opponent_id VARCHAR(100) NOT NULL,
  
  -- Difficulty factors
  difficulty_score INTEGER NOT NULL CHECK (difficulty_score BETWEEN 1 AND 5),
  opponent_rank INTEGER,
  opponent_form_avg DECIMAL(10,2),
  is_home BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  calculated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(league_id, round_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_fixture_difficulty_league ON fixture_difficulty_ratings(league_id);
CREATE INDEX IF NOT EXISTS idx_fixture_difficulty_round ON fixture_difficulty_ratings(round_id);
CREATE INDEX IF NOT EXISTS idx_fixture_difficulty_team ON fixture_difficulty_ratings(team_id);

-- ============================================================================
-- CREATE fantasy_predictions TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS fantasy_predictions (
  id SERIAL PRIMARY KEY,
  prediction_id VARCHAR(100) UNIQUE NOT NULL,
  league_id VARCHAR(100) NOT NULL,
  team_id VARCHAR(100) NOT NULL,
  round_id VARCHAR(100) NOT NULL,
  
  -- Predictions (JSONB for flexibility)
  predictions JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Scoring
  bonus_points DECIMAL(10,2) DEFAULT 0,
  correct_predictions INTEGER DEFAULT 0,
  total_predictions INTEGER DEFAULT 0,
  
  -- Status
  is_locked BOOLEAN DEFAULT FALSE,
  locked_at TIMESTAMP,
  calculated_at TIMESTAMP,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(league_id, team_id, round_id)
);

CREATE INDEX IF NOT EXISTS idx_predictions_league ON fantasy_predictions(league_id);
CREATE INDEX IF NOT EXISTS idx_predictions_team ON fantasy_predictions(team_id);
CREATE INDEX IF NOT EXISTS idx_predictions_round ON fantasy_predictions(round_id);
CREATE INDEX IF NOT EXISTS idx_predictions_locked ON fantasy_predictions(is_locked);

COMMENT ON TABLE fantasy_predictions IS 'Weekly match predictions for bonus points';
COMMENT ON COLUMN fantasy_predictions.predictions IS 'JSONB: {match_id: {winner, score, motm}}';

-- ============================================================================
-- CREATE fantasy_challenges TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS fantasy_challenges (
  id SERIAL PRIMARY KEY,
  challenge_id VARCHAR(100) UNIQUE NOT NULL,
  league_id VARCHAR(100) NOT NULL,
  round_id VARCHAR(100),
  
  -- Challenge details
  challenge_name VARCHAR(200) NOT NULL,
  challenge_description TEXT,
  challenge_type VARCHAR(50) NOT NULL,
  
  -- Requirements (JSONB for flexibility)
  requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Rewards
  bonus_points INTEGER DEFAULT 0,
  badge_name VARCHAR(100),
  
  -- Timing
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_challenges_league ON fantasy_challenges(league_id);
CREATE INDEX IF NOT EXISTS idx_challenges_round ON fantasy_challenges(round_id);
CREATE INDEX IF NOT EXISTS idx_challenges_active ON fantasy_challenges(is_active);
CREATE INDEX IF NOT EXISTS idx_challenges_dates ON fantasy_challenges(start_date, end_date);

COMMENT ON TABLE fantasy_challenges IS 'Weekly and season-long challenges';
COMMENT ON COLUMN fantasy_challenges.requirements IS 'JSONB: challenge-specific requirements';

-- ============================================================================
-- CREATE fantasy_challenge_completions TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS fantasy_challenge_completions (
  id SERIAL PRIMARY KEY,
  completion_id VARCHAR(100) UNIQUE NOT NULL,
  challenge_id VARCHAR(100) NOT NULL REFERENCES fantasy_challenges(challenge_id),
  team_id VARCHAR(100) NOT NULL,
  
  -- Completion details
  completed_at TIMESTAMP DEFAULT NOW(),
  bonus_points_awarded INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_challenge_completions_challenge ON fantasy_challenge_completions(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_completions_team ON fantasy_challenge_completions(team_id);
CREATE INDEX IF NOT EXISTS idx_challenge_completions_completed ON fantasy_challenge_completions(completed_at);

-- ============================================================================
-- CREATE fantasy_power_ups TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS fantasy_power_ups (
  id SERIAL PRIMARY KEY,
  power_up_id VARCHAR(100) UNIQUE NOT NULL,
  team_id VARCHAR(100) NOT NULL,
  league_id VARCHAR(100) NOT NULL,
  
  -- Power-up inventory
  triple_captain_remaining INTEGER DEFAULT 1,
  bench_boost_remaining INTEGER DEFAULT 2,
  free_hit_remaining INTEGER DEFAULT 1,
  wildcard_remaining INTEGER DEFAULT 2,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(team_id, league_id)
);

CREATE INDEX IF NOT EXISTS idx_power_ups_team ON fantasy_power_ups(team_id);
CREATE INDEX IF NOT EXISTS idx_power_ups_league ON fantasy_power_ups(league_id);

COMMENT ON TABLE fantasy_power_ups IS 'Power-up inventory for each team';

-- ============================================================================
-- CREATE fantasy_power_up_usage TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS fantasy_power_up_usage (
  id SERIAL PRIMARY KEY,
  usage_id VARCHAR(100) UNIQUE NOT NULL,
  team_id VARCHAR(100) NOT NULL,
  league_id VARCHAR(100) NOT NULL,
  round_id VARCHAR(100) NOT NULL,
  
  -- Power-up details
  power_up_type VARCHAR(50) NOT NULL,
  
  -- Metadata
  used_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT check_power_up_type CHECK (power_up_type IN ('triple_captain', 'bench_boost', 'free_hit', 'wildcard'))
);

CREATE INDEX IF NOT EXISTS idx_power_up_usage_team ON fantasy_power_up_usage(team_id);
CREATE INDEX IF NOT EXISTS idx_power_up_usage_round ON fantasy_power_up_usage(round_id);
CREATE INDEX IF NOT EXISTS idx_power_up_usage_type ON fantasy_power_up_usage(power_up_type);

COMMENT ON TABLE fantasy_power_up_usage IS 'Track when power-ups are used';

-- ============================================================================
-- CREATE fantasy_h2h_fixtures TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS fantasy_h2h_fixtures (
  id SERIAL PRIMARY KEY,
  fixture_id VARCHAR(100) UNIQUE NOT NULL,
  league_id VARCHAR(100) NOT NULL,
  round_id VARCHAR(100) NOT NULL,
  
  -- Teams
  team_a_id VARCHAR(100) NOT NULL,
  team_b_id VARCHAR(100) NOT NULL,
  
  -- Scores
  team_a_points DECIMAL(10,2) DEFAULT 0,
  team_b_points DECIMAL(10,2) DEFAULT 0,
  
  -- Result
  winner_id VARCHAR(100),
  is_draw BOOLEAN DEFAULT FALSE,
  
  -- Status
  status VARCHAR(20) DEFAULT 'scheduled',
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT check_different_teams CHECK (team_a_id != team_b_id),
  CONSTRAINT check_h2h_status CHECK (status IN ('scheduled', 'in_progress', 'completed'))
);

CREATE INDEX IF NOT EXISTS idx_h2h_fixtures_league ON fantasy_h2h_fixtures(league_id);
CREATE INDEX IF NOT EXISTS idx_h2h_fixtures_round ON fantasy_h2h_fixtures(round_id);
CREATE INDEX IF NOT EXISTS idx_h2h_fixtures_team_a ON fantasy_h2h_fixtures(team_a_id);
CREATE INDEX IF NOT EXISTS idx_h2h_fixtures_team_b ON fantasy_h2h_fixtures(team_b_id);
CREATE INDEX IF NOT EXISTS idx_h2h_fixtures_status ON fantasy_h2h_fixtures(status);

COMMENT ON TABLE fantasy_h2h_fixtures IS 'Head-to-head weekly matchups';

-- ============================================================================
-- CREATE fantasy_h2h_standings TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS fantasy_h2h_standings (
  id SERIAL PRIMARY KEY,
  standing_id VARCHAR(100) UNIQUE NOT NULL,
  league_id VARCHAR(100) NOT NULL,
  team_id VARCHAR(100) NOT NULL,
  
  -- H2H record
  matches_played INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  draws INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  points INTEGER DEFAULT 0,
  
  -- Points for/against
  points_for DECIMAL(10,2) DEFAULT 0,
  points_against DECIMAL(10,2) DEFAULT 0,
  points_difference DECIMAL(10,2) DEFAULT 0,
  
  -- Metadata
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(league_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_h2h_standings_league ON fantasy_h2h_standings(league_id);
CREATE INDEX IF NOT EXISTS idx_h2h_standings_team ON fantasy_h2h_standings(team_id);
CREATE INDEX IF NOT EXISTS idx_h2h_standings_points ON fantasy_h2h_standings(league_id, points DESC);

COMMENT ON TABLE fantasy_h2h_standings IS 'Head-to-head league standings';

-- ============================================================================
-- CREATE fantasy_chat_messages TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS fantasy_chat_messages (
  id SERIAL PRIMARY KEY,
  message_id VARCHAR(100) UNIQUE NOT NULL,
  league_id VARCHAR(100) NOT NULL,
  team_id VARCHAR(100) NOT NULL,
  user_id VARCHAR(100) NOT NULL,
  
  -- Message content
  message_text TEXT NOT NULL,
  
  -- Reactions (JSONB for flexibility)
  reactions JSONB DEFAULT '{}'::jsonb,
  
  -- Status
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_league ON fantasy_chat_messages(league_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_team ON fantasy_chat_messages(team_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON fantasy_chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON fantasy_chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_deleted ON fantasy_chat_messages(is_deleted);

COMMENT ON TABLE fantasy_chat_messages IS 'League chat messages';
COMMENT ON COLUMN fantasy_chat_messages.reactions IS 'JSONB: {emoji: [user_ids]}';

-- ============================================================================
-- CREATE fantasy_achievements TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS fantasy_achievements (
  id SERIAL PRIMARY KEY,
  achievement_id VARCHAR(100) UNIQUE NOT NULL,
  
  -- Achievement details
  achievement_name VARCHAR(200) NOT NULL,
  achievement_description TEXT,
  achievement_category VARCHAR(50) NOT NULL,
  
  -- Requirements (JSONB for flexibility)
  requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Rewards
  badge_icon VARCHAR(50),
  badge_color VARCHAR(50),
  points_reward INTEGER DEFAULT 0,
  
  -- Rarity
  rarity VARCHAR(20) DEFAULT 'common',
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT check_rarity CHECK (rarity IN ('common', 'rare', 'epic', 'legendary'))
);

CREATE INDEX IF NOT EXISTS idx_achievements_category ON fantasy_achievements(achievement_category);
CREATE INDEX IF NOT EXISTS idx_achievements_active ON fantasy_achievements(is_active);
CREATE INDEX IF NOT EXISTS idx_achievements_rarity ON fantasy_achievements(rarity);

COMMENT ON TABLE fantasy_achievements IS 'Achievement definitions';
COMMENT ON COLUMN fantasy_achievements.requirements IS 'JSONB: achievement-specific requirements';

-- ============================================================================
-- CREATE fantasy_team_achievements TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS fantasy_team_achievements (
  id SERIAL PRIMARY KEY,
  team_achievement_id VARCHAR(100) UNIQUE NOT NULL,
  team_id VARCHAR(100) NOT NULL,
  achievement_id VARCHAR(100) NOT NULL REFERENCES fantasy_achievements(achievement_id),
  
  -- Unlock details
  unlocked_at TIMESTAMP DEFAULT NOW(),
  progress JSONB DEFAULT '{}'::jsonb,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(team_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_team_achievements_team ON fantasy_team_achievements(team_id);
CREATE INDEX IF NOT EXISTS idx_team_achievements_achievement ON fantasy_team_achievements(achievement_id);
CREATE INDEX IF NOT EXISTS idx_team_achievements_unlocked ON fantasy_team_achievements(unlocked_at DESC);

COMMENT ON TABLE fantasy_team_achievements IS 'Achievements unlocked by teams';

-- ============================================================================
-- ADD AUTO-SUB CONFIGURATION
-- ============================================================================

-- Add auto-sub settings to fantasy_teams table
ALTER TABLE fantasy_teams
ADD COLUMN IF NOT EXISTS auto_sub_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS bench_priority JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN fantasy_teams.auto_sub_enabled IS 'Enable automatic substitutions';
COMMENT ON COLUMN fantasy_teams.bench_priority IS 'JSONB array of player IDs in priority order';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN (
  'fixture_difficulty_ratings',
  'fantasy_predictions',
  'fantasy_challenges',
  'fantasy_challenge_completions',
  'fantasy_power_ups',
  'fantasy_power_up_usage',
  'fantasy_h2h_fixtures',
  'fantasy_h2h_standings',
  'fantasy_chat_messages',
  'fantasy_achievements',
  'fantasy_team_achievements'
)
ORDER BY table_name;

-- Verify indexes were created
SELECT 
  tablename, 
  indexname
FROM pg_indexes
WHERE tablename IN (
  'fixture_difficulty_ratings',
  'fantasy_predictions',
  'fantasy_challenges',
  'fantasy_challenge_completions',
  'fantasy_power_ups',
  'fantasy_power_up_usage',
  'fantasy_h2h_fixtures',
  'fantasy_h2h_standings',
  'fantasy_chat_messages',
  'fantasy_achievements',
  'fantasy_team_achievements'
)
ORDER BY tablename, indexname;

-- ============================================================================
-- SAMPLE DATA (for testing)
-- ============================================================================

-- Example achievement
/*
INSERT INTO fantasy_achievements (
  achievement_id,
  achievement_name,
  achievement_description,
  achievement_category,
  requirements,
  badge_icon,
  badge_color,
  rarity
) VALUES (
  'achievement_champion',
  'League Champion',
  'Win the fantasy league',
  'season',
  '{"rank": 1}'::jsonb,
  '🏆',
  'gold',
  'legendary'
);
*/

-- Example challenge
/*
INSERT INTO fantasy_challenges (
  challenge_id,
  league_id,
  round_id,
  challenge_name,
  challenge_description,
  challenge_type,
  requirements,
  bonus_points,
  start_date,
  end_date
) VALUES (
  'challenge_captain_masterclass',
  'league_1',
  'round_1',
  'Captain Masterclass',
  'Your captain scores 20+ points',
  'weekly',
  '{"captain_points": 20}'::jsonb,
  10,
  NOW(),
  NOW() + INTERVAL '7 days'
);
*/

