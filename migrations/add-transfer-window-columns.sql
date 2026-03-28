-- Add columns to fantasy_transfer_windows to match UI expectations
-- This migration adds simplified columns for basic transfer window management

-- Add new columns if they don't exist
ALTER TABLE fantasy_transfer_windows
ADD COLUMN IF NOT EXISTS window_name VARCHAR(200),
ADD COLUMN IF NOT EXISTS opens_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS closes_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;

-- Migrate existing data if needed
UPDATE fantasy_transfer_windows
SET 
  window_name = COALESCE(window_name, 'Transfer Window ' || id),
  opens_at = COALESCE(opens_at, start_time),
  closes_at = COALESCE(closes_at, end_time),
  is_active = COALESCE(is_active, (status = 'active'))
WHERE window_name IS NULL OR opens_at IS NULL OR closes_at IS NULL;

-- Add check constraint for dates
ALTER TABLE fantasy_transfer_windows
DROP CONSTRAINT IF EXISTS check_closes_after_opens;

ALTER TABLE fantasy_transfer_windows
ADD CONSTRAINT check_closes_after_opens CHECK (closes_at > opens_at);

-- Create index for active windows
CREATE INDEX IF NOT EXISTS idx_fantasy_transfer_windows_active 
ON fantasy_transfer_windows(league_id, is_active) 
WHERE is_active = true;

-- Create index for window timing
CREATE INDEX IF NOT EXISTS idx_fantasy_transfer_windows_timing 
ON fantasy_transfer_windows(league_id, opens_at, closes_at);

-- Add comment
COMMENT ON COLUMN fantasy_transfer_windows.window_name IS 'Display name for the transfer window';
COMMENT ON COLUMN fantasy_transfer_windows.opens_at IS 'When the transfer window opens';
COMMENT ON COLUMN fantasy_transfer_windows.closes_at IS 'When the transfer window closes';
COMMENT ON COLUMN fantasy_transfer_windows.is_active IS 'Whether the window is currently active (only one can be active per league)';
