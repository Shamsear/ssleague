-- Add max_squad_size column to auction_settings table

ALTER TABLE auction_settings
ADD COLUMN IF NOT EXISTS max_squad_size INTEGER DEFAULT 25;

-- Add comment for documentation
COMMENT ON COLUMN auction_settings.max_squad_size IS 'Maximum number of players each team can have (default: 25)';

-- Update existing records with default value
UPDATE auction_settings
SET max_squad_size = 25
WHERE max_squad_size IS NULL;

SELECT 'max_squad_size column added successfully!' as status;
