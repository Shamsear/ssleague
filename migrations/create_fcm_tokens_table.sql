-- Migration: Create fcm_tokens table for multi-device push notifications
-- Database: Tournament DB (Neon)
-- Date: 2025-01-06

CREATE TABLE IF NOT EXISTS fcm_tokens (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  token TEXT NOT NULL UNIQUE,
  device_name VARCHAR(255),
  device_type VARCHAR(50),     -- 'mobile', 'desktop', 'tablet'
  browser VARCHAR(100),         -- 'Chrome', 'Firefox', 'Safari', 'Edge'
  os VARCHAR(100),              -- 'Windows', 'macOS', 'iOS', 'Android'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_id ON fcm_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_active ON fcm_tokens(is_active);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_active ON fcm_tokens(user_id, is_active);

-- Comment on table
COMMENT ON TABLE fcm_tokens IS 'Stores Firebase Cloud Messaging tokens for push notifications. Supports multiple devices per user.';

-- Comment on columns
COMMENT ON COLUMN fcm_tokens.user_id IS 'Firebase UID of the user';
COMMENT ON COLUMN fcm_tokens.token IS 'FCM registration token (unique per device)';
COMMENT ON COLUMN fcm_tokens.device_name IS 'User-friendly device name (e.g., "My iPhone")';
COMMENT ON COLUMN fcm_tokens.device_type IS 'Device category: mobile, desktop, or tablet';
COMMENT ON COLUMN fcm_tokens.browser IS 'Browser name (Chrome, Firefox, Safari, Edge)';
COMMENT ON COLUMN fcm_tokens.os IS 'Operating system (Windows, macOS, iOS, Android, Linux)';
COMMENT ON COLUMN fcm_tokens.is_active IS 'Whether this token is still valid (false if expired/revoked)';
COMMENT ON COLUMN fcm_tokens.last_used_at IS 'Last time this token was used to send a notification';
