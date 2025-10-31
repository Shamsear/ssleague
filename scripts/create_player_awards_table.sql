-- Create player_awards table to store season-end permanent awards for players
-- This is separate from the weekly/daily awards system

CREATE TABLE IF NOT EXISTS player_awards (
    id SERIAL PRIMARY KEY,
    player_id VARCHAR(255) NOT NULL,
    player_name VARCHAR(255) NOT NULL,
    season_id INTEGER NOT NULL,
    award_name VARCHAR(255) NOT NULL,
    award_position VARCHAR(100),
    award_value NUMERIC(10, 2),
    category VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraint: One award per player per season
    CONSTRAINT unique_player_season_award UNIQUE (player_id, season_id, award_name)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_player_awards_player_id ON player_awards(player_id);
CREATE INDEX IF NOT EXISTS idx_player_awards_season_id ON player_awards(season_id);
CREATE INDEX IF NOT EXISTS idx_player_awards_player_season ON player_awards(player_id, season_id);
CREATE INDEX IF NOT EXISTS idx_player_awards_category ON player_awards(category);
CREATE INDEX IF NOT EXISTS idx_player_awards_category_award ON player_awards(category, award_name);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_player_awards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_player_awards_updated_at
    BEFORE UPDATE ON player_awards
    FOR EACH ROW
    EXECUTE FUNCTION update_player_awards_updated_at();

-- Add awards_count column to player_season if it doesn't exist
-- (Commented out as player_season table may not exist yet)
-- DO $$ 
-- BEGIN
--     IF NOT EXISTS (
--         SELECT 1 FROM information_schema.columns 
--         WHERE table_name = 'player_season' 
--         AND column_name = 'awards_count'
--     ) THEN
--         ALTER TABLE player_season ADD COLUMN awards_count INTEGER DEFAULT 0;
--     END IF;
-- END $$;

-- Create view for player awards summary
CREATE OR REPLACE VIEW player_awards_summary AS
SELECT 
    pa.player_id,
    pa.player_name,
    pa.season_id,
    COUNT(pa.id) as total_awards,
    STRING_AGG(pa.award_name, ', ' ORDER BY pa.created_at) as awards_list
FROM player_awards pa
GROUP BY pa.player_id, pa.player_name, pa.season_id;

COMMENT ON TABLE player_awards IS 'Stores season-end permanent awards for players (Golden Boot, Best Attacker, etc.)';
COMMENT ON COLUMN player_awards.award_name IS 'Name of the award (e.g., Golden Boot, Best Midfielder)';
COMMENT ON COLUMN player_awards.award_position IS 'Position/rank within the award (e.g., Winner, Runner-up, Third Place)';
COMMENT ON COLUMN player_awards.award_value IS 'Optional numeric value associated with award (e.g., goals scored for Golden Boot)';
