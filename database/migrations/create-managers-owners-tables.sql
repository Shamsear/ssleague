-- Managers Table
-- Stores manager information for each team
-- Managers can be either existing players or non-playing managers
CREATE TABLE IF NOT EXISTS managers (
    id SERIAL PRIMARY KEY,
    manager_id VARCHAR(255) UNIQUE NOT NULL, -- Format: SSPSM + counter (e.g., SSPSM0001)
    
    -- Team and Season relationship
    team_id VARCHAR(255) NOT NULL,
    season_id VARCHAR(255) NOT NULL,
    
    -- Manager Details
    name VARCHAR(255) NOT NULL,
    photo_url TEXT, -- ImageKit URL
    photo_file_id VARCHAR(255), -- ImageKit file ID for deletion
    
    -- Player Relationship (if manager is a player)
    player_id VARCHAR(255), -- References realplayers.id if manager is a player
    is_player BOOLEAN DEFAULT false,
    
    -- Contact Info (if non-playing manager)
    email VARCHAR(255),
    phone VARCHAR(50),
    
    -- Additional Info
    date_of_birth DATE,
    place VARCHAR(255),
    nationality VARCHAR(100),
    jersey_number INTEGER,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255), -- User ID who created this
    
    -- Constraints
    UNIQUE(team_id, season_id) -- One manager per team per season
);

CREATE INDEX idx_managers_team_id ON managers(team_id);
CREATE INDEX idx_managers_season_id ON managers(season_id);
CREATE INDEX idx_managers_player_id ON managers(player_id);
CREATE INDEX idx_managers_team_season ON managers(team_id, season_id);

-- Owners Table
-- Stores owner information for each team
CREATE TABLE IF NOT EXISTS owners (
    id SERIAL PRIMARY KEY,
    owner_id VARCHAR(255) UNIQUE NOT NULL, -- Format: SSPSO + counter (e.g., SSPSO0001)
    
    -- Team and Season relationship
    team_id VARCHAR(255) NOT NULL,
    season_id VARCHAR(255), -- Can be NULL for team-wide owner (across all seasons)
    
    -- Owner Details
    name VARCHAR(255) NOT NULL,
    photo_url TEXT, -- ImageKit URL
    photo_file_id VARCHAR(255), -- ImageKit file ID for deletion
    
    -- Contact Info
    email VARCHAR(255),
    registered_email VARCHAR(255), -- Email used during registration
    phone VARCHAR(50),
    
    -- Additional Info
    date_of_birth DATE,
    place VARCHAR(255),
    nationality VARCHAR(100),
    bio TEXT,
    
    -- Social Media (optional)
    instagram_handle VARCHAR(100),
    twitter_handle VARCHAR(100),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255), -- User ID who created/registered this
    registered_user_id VARCHAR(255) -- Firebase user ID who registered
);

CREATE INDEX idx_owners_team_id ON owners(team_id);
CREATE INDEX idx_owners_season_id ON owners(season_id);
CREATE INDEX idx_owners_team_season ON owners(team_id, season_id);
CREATE INDEX idx_owners_email ON owners(email);

-- Trigger to update updated_at timestamp for managers
CREATE OR REPLACE FUNCTION update_managers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_managers_updated_at 
    BEFORE UPDATE ON managers 
    FOR EACH ROW 
    EXECUTE FUNCTION update_managers_updated_at();

-- Trigger to update updated_at timestamp for owners
CREATE OR REPLACE FUNCTION update_owners_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_owners_updated_at 
    BEFORE UPDATE ON owners 
    FOR EACH ROW 
    EXECUTE FUNCTION update_owners_updated_at();

-- Comments for documentation
COMMENT ON TABLE managers IS 'Stores team manager information - can be either existing players or non-playing managers';
COMMENT ON TABLE owners IS 'Stores team owner information registered during team registration or later';
COMMENT ON COLUMN managers.player_id IS 'NULL if non-playing manager, otherwise references realplayers.id';
COMMENT ON COLUMN owners.season_id IS 'NULL means owner across all seasons, otherwise specific to one season';
