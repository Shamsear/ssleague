-- Add indexes to footballplayers table for better query performance
-- Run this on your Neon database

-- Index for position filtering
CREATE INDEX IF NOT EXISTS idx_footballplayers_position ON footballplayers(position);

-- Index for position_group filtering
CREATE INDEX IF NOT EXISTS idx_footballplayers_position_group ON footballplayers(position_group);

-- Index for playing_style filtering
CREATE INDEX IF NOT EXISTS idx_footballplayers_playing_style ON footballplayers(playing_style);

-- Index for name search (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_footballplayers_name_lower ON footballplayers(LOWER(name));

-- Index for overall_rating (used in ORDER BY)
CREATE INDEX IF NOT EXISTS idx_footballplayers_overall_rating ON footballplayers(overall_rating DESC);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_footballplayers_rating_name ON footballplayers(overall_rating DESC, name);

-- Index for team_id lookups
CREATE INDEX IF NOT EXISTS idx_footballplayers_team_id ON footballplayers(team_id) WHERE team_id IS NOT NULL;

-- Index for auction eligibility
CREATE INDEX IF NOT EXISTS idx_footballplayers_auction_eligible ON footballplayers(is_auction_eligible) WHERE is_auction_eligible = true;

-- Analyze the table to update statistics
ANALYZE footballplayers;
