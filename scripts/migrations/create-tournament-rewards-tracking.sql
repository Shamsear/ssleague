-- Create tournament rewards distribution tracking table
-- This table tracks which rewards have been distributed to prevent duplicates

CREATE TABLE IF NOT EXISTS tournament_rewards_distributed (
    id SERIAL PRIMARY KEY,
    tournament_id VARCHAR(255) NOT NULL,
    team_id VARCHAR(255) NOT NULL,
    season_id VARCHAR(255) NOT NULL,
    reward_type VARCHAR(50) NOT NULL, -- 'position', 'knockout', 'completion'
    reward_details JSONB, -- Store position number, knockout stage, etc.
    ecoin_amount INTEGER DEFAULT 0,
    sscoin_amount INTEGER DEFAULT 0,
    distributed_by VARCHAR(255),
    distributed_at TIMESTAMP DEFAULT NOW(),
    notes TEXT
);

-- Create unique index using expression for JSONB
-- This prevents duplicate rewards for the same tournament, team, and reward type
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_reward 
ON tournament_rewards_distributed(tournament_id, team_id, reward_type, (reward_details::text));

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_rewards_tournament ON tournament_rewards_distributed(tournament_id);
CREATE INDEX IF NOT EXISTS idx_rewards_team ON tournament_rewards_distributed(team_id);
CREATE INDEX IF NOT EXISTS idx_rewards_type ON tournament_rewards_distributed(reward_type);
CREATE INDEX IF NOT EXISTS idx_rewards_season ON tournament_rewards_distributed(season_id);

-- Add comments
COMMENT ON TABLE tournament_rewards_distributed IS 'Tracks tournament rewards distributed to teams to prevent duplicate distributions';
COMMENT ON COLUMN tournament_rewards_distributed.reward_type IS 'Type of reward: position, knockout, or completion';
COMMENT ON COLUMN tournament_rewards_distributed.reward_details IS 'JSON details like {"position": 1} or {"stage": "final", "result": "winner"}';
