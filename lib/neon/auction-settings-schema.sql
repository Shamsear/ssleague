-- Auction Settings Table
CREATE TABLE IF NOT EXISTS auction_settings (
    id SERIAL PRIMARY KEY,
    season_id VARCHAR(255),
    max_rounds INTEGER DEFAULT 25,
    min_balance_per_round INTEGER DEFAULT 30,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index on season_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_auction_settings_season ON auction_settings(season_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_auction_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_auction_settings_updated_at 
    BEFORE UPDATE ON auction_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_auction_settings_updated_at();

-- Insert default settings if none exist
INSERT INTO auction_settings (season_id, max_rounds, min_balance_per_round)
VALUES ('default', 25, 30)
ON CONFLICT DO NOTHING;
