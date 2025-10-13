-- ============================================
-- Update Minimum Bid Amount from 100 to 10
-- ============================================
-- This migration updates the CHECK constraint on the bids table
-- to allow minimum bid amount of £10 instead of £100

-- Drop the old constraint
ALTER TABLE bids DROP CONSTRAINT IF EXISTS bids_amount_check;

-- Add new constraint with minimum of 10
ALTER TABLE bids ADD CONSTRAINT bids_amount_check CHECK (amount >= 10);

-- Verify the change
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'bids'::regclass
  AND conname = 'bids_amount_check';

-- Show summary
DO $$
BEGIN
  RAISE NOTICE '✅ Minimum bid amount updated successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Old constraint: amount >= 100';
  RAISE NOTICE 'New constraint: amount >= 10';
  RAISE NOTICE '';
  RAISE NOTICE 'Teams can now place bids starting from £10';
END $$;
