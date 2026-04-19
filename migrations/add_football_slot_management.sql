-- Add football slot management fields to team_seasons table
-- This allows teams to purchase additional slots beyond the base limit

-- Add columns to team_seasons (Firebase)
-- Note: These will be added to Firebase team_seasons documents programmatically
-- Fields to add:
-- - football_base_slots: number (default 25) - Base slots every team gets
-- - football_purchased_slots: number (default 0) - Additional slots purchased
-- - football_total_slots: number (default 25) - Total available slots (base + purchased)
-- - football_max_purchasable_slots: number (default 3) - Max slots that can be purchased
-- - football_slot_price: number (default 10) - eCoin cost per additional slot

-- Add columns to teams table in Neon (auction database)
-- This is for the auction database to track slot purchases
ALTER TABLE teams ADD COLUMN IF NOT EXISTS football_base_slots INTEGER DEFAULT 25;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS football_purchased_slots INTEGER DEFAULT 0;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS football_total_slots INTEGER DEFAULT 25;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_teams_total_slots ON teams(football_total_slots);

-- Add comment
COMMENT ON COLUMN teams.football_base_slots IS 'Base number of football player slots (default 25)';
COMMENT ON COLUMN teams.football_purchased_slots IS 'Number of additional slots purchased';
COMMENT ON COLUMN teams.football_total_slots IS 'Total available slots (base + purchased)';

-- Create a table to track slot purchase history
CREATE TABLE IF NOT EXISTS football_slot_purchases (
  id SERIAL PRIMARY KEY,
  team_id VARCHAR(255) NOT NULL,
  season_id VARCHAR(255) NOT NULL,
  slots_purchased INTEGER NOT NULL,
  price_per_slot DECIMAL(10, 2) NOT NULL,
  total_cost DECIMAL(10, 2) NOT NULL,
  purchased_at TIMESTAMP DEFAULT NOW(),
  purchased_by VARCHAR(255), -- user who made the purchase
  notes TEXT,
  CONSTRAINT fk_slot_purchase_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_slot_purchases_team ON football_slot_purchases(team_id);
CREATE INDEX IF NOT EXISTS idx_slot_purchases_season ON football_slot_purchases(season_id);
CREATE INDEX IF NOT EXISTS idx_slot_purchases_date ON football_slot_purchases(purchased_at);

-- Add comments
COMMENT ON TABLE football_slot_purchases IS 'Tracks history of football slot purchases by teams';
COMMENT ON COLUMN football_slot_purchases.team_id IS 'Team that purchased slots';
COMMENT ON COLUMN football_slot_purchases.season_id IS 'Season in which slots were purchased';
COMMENT ON COLUMN football_slot_purchases.slots_purchased IS 'Number of slots purchased in this transaction';
COMMENT ON COLUMN football_slot_purchases.price_per_slot IS 'eCoin price per slot at time of purchase';
COMMENT ON COLUMN football_slot_purchases.total_cost IS 'Total eCoin cost for this purchase';
