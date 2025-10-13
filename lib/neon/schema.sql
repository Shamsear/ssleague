-- Football Players Table
CREATE TABLE IF NOT EXISTS footballplayers (
    id VARCHAR(255) PRIMARY KEY,
    player_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    position VARCHAR(50),
    position_group VARCHAR(50),
    
    -- Team and Season
    team_id VARCHAR(255),
    team_name VARCHAR(255),
    season_id VARCHAR(255),
    round_id VARCHAR(255),
    
    -- Auction
    is_auction_eligible BOOLEAN DEFAULT true,
    is_sold BOOLEAN DEFAULT false,
    acquisition_value INTEGER,
    
    -- Basic Info
    nationality VARCHAR(100),
    age INTEGER,
    club VARCHAR(255),
    playing_style VARCHAR(50),
    overall_rating INTEGER,
    
    -- Offensive Attributes
    offensive_awareness INTEGER,
    ball_control INTEGER,
    dribbling INTEGER,
    tight_possession INTEGER,
    low_pass INTEGER,
    lofted_pass INTEGER,
    finishing INTEGER,
    heading INTEGER,
    set_piece_taking INTEGER,
    curl INTEGER,
    
    -- Physical Attributes
    speed INTEGER,
    acceleration INTEGER,
    kicking_power INTEGER,
    jumping INTEGER,
    physical_contact INTEGER,
    balance INTEGER,
    stamina INTEGER,
    
    -- Defensive Attributes
    defensive_awareness INTEGER,
    tackling INTEGER,
    aggression INTEGER,
    defensive_engagement INTEGER,
    
    -- Goalkeeper Attributes
    gk_awareness INTEGER,
    gk_catching INTEGER,
    gk_parrying INTEGER,
    gk_reflexes INTEGER,
    gk_reach INTEGER,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Indexes for common queries
    INDEX idx_position (position),
    INDEX idx_team_id (team_id),
    INDEX idx_season_id (season_id),
    INDEX idx_round_id (round_id),
    INDEX idx_auction_eligible (is_auction_eligible),
    INDEX idx_is_sold (is_sold),
    INDEX idx_overall_rating (overall_rating),
    INDEX idx_name (name)
);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_footballplayers_updated_at BEFORE UPDATE
    ON footballplayers FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
