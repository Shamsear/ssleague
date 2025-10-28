-- Add transfer settings columns to transfer_windows table
-- Each window can have its own transfer settings

ALTER TABLE transfer_windows
ADD COLUMN IF NOT EXISTS max_transfers_per_window INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS points_cost_per_transfer INTEGER DEFAULT 4,
ADD COLUMN IF NOT EXISTS transfer_window_start TIMESTAMP,
ADD COLUMN IF NOT EXISTS transfer_window_end TIMESTAMP;

-- Comments
COMMENT ON COLUMN transfer_windows.max_transfers_per_window IS 'Maximum number of transfers allowed during this window';
COMMENT ON COLUMN transfer_windows.points_cost_per_transfer IS 'Fantasy points deducted per transfer made in this window';
COMMENT ON COLUMN transfer_windows.transfer_window_start IS 'When transfers can start being made (can be different from opens_at)';
COMMENT ON COLUMN transfer_windows.transfer_window_end IS 'When transfers can no longer be made (can be different from closes_at)';
