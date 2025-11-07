-- Add phase configuration columns to auction_settings table
-- This enables the three-phase budget reserve system

ALTER TABLE auction_settings
ADD COLUMN IF NOT EXISTS phase_1_end_round INTEGER DEFAULT 18,
ADD COLUMN IF NOT EXISTS phase_1_min_balance INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS phase_2_end_round INTEGER DEFAULT 20,
ADD COLUMN IF NOT EXISTS phase_2_min_balance INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS phase_3_min_balance INTEGER DEFAULT 10;

-- Add comment for documentation
COMMENT ON COLUMN auction_settings.phase_1_end_round IS 'Last round of Phase 1 (strict reserve enforcement)';
COMMENT ON COLUMN auction_settings.phase_1_min_balance IS 'Minimum balance per round in Phase 1 (default: 30)';
COMMENT ON COLUMN auction_settings.phase_2_end_round IS 'Last round of Phase 2 (soft reserve, skippable)';
COMMENT ON COLUMN auction_settings.phase_2_min_balance IS 'Minimum balance per round in Phase 2 (default: 30)';
COMMENT ON COLUMN auction_settings.phase_3_min_balance IS 'Minimum balance per player slot in Phase 3 (default: 10)';

-- Update existing records with default values
UPDATE auction_settings
SET 
  phase_1_end_round = 18,
  phase_1_min_balance = 30,
  phase_2_end_round = 20,
  phase_2_min_balance = 30,
  phase_3_min_balance = 10
WHERE phase_1_end_round IS NULL;

SELECT 'Reserve phase columns added successfully!' as status;
