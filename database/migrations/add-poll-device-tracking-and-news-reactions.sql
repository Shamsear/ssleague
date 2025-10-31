-- ============================================
-- ENHANCE POLLS WITH DEVICE TRACKING
-- ============================================

-- Add device tracking columns to poll_votes
ALTER TABLE poll_votes 
  ADD COLUMN IF NOT EXISTS voter_name VARCHAR(255), -- Required for anonymous voters
  ADD COLUMN IF NOT EXISTS device_fingerprint VARCHAR(255), -- Unique device ID
  ADD COLUMN IF NOT EXISTS ip_address VARCHAR(50),
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS browser_info JSONB,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP, -- Track vote changes
  
  -- Admin management
  ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS flag_reason VARCHAR(255),
  ADD COLUMN IF NOT EXISTS admin_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS admin_notes TEXT,
  ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(100),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Drop old unique constraint and add new one
ALTER TABLE poll_votes DROP CONSTRAINT IF EXISTS poll_votes_poll_id_user_id_key;

-- One device = one vote (STRICT)
CREATE UNIQUE INDEX IF NOT EXISTS idx_poll_votes_device_unique 
  ON poll_votes(poll_id, device_fingerprint) 
  WHERE deleted_at IS NULL;

-- Index for finding duplicate names across devices
CREATE INDEX IF NOT EXISTS idx_poll_votes_name ON poll_votes(poll_id, voter_name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_poll_votes_flagged ON poll_votes(poll_id, is_flagged) WHERE is_flagged = TRUE;

-- ============================================
-- CREATE NEWS REACTIONS SYSTEM
-- ============================================

-- News reactions table (anonymous emoji reactions)
CREATE TABLE IF NOT EXISTS news_reactions (
  id SERIAL PRIMARY KEY,
  reaction_id VARCHAR(100) UNIQUE NOT NULL,
  news_id VARCHAR(255) NOT NULL,
  
  -- User identification (optional if logged in)
  user_id VARCHAR(100), -- NULL for anonymous
  device_fingerprint VARCHAR(255) NOT NULL, -- Track by device
  
  -- Reaction type (emoji reactions)
  reaction_type VARCHAR(20) NOT NULL,
  -- Options: 'helpful', 'love', 'funny', 'wow', 'sad', 'angry'
  
  -- Metadata
  ip_address VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- One device = one reaction type per article
  UNIQUE(news_id, device_fingerprint)
);

-- Reaction counts cache for performance
CREATE TABLE IF NOT EXISTS news_reaction_counts (
  id SERIAL PRIMARY KEY,
  news_id VARCHAR(255) NOT NULL,
  reaction_type VARCHAR(20) NOT NULL,
  count INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(news_id, reaction_type)
);

-- Indexes for news reactions
CREATE INDEX IF NOT EXISTS idx_news_reactions_news ON news_reactions(news_id);
CREATE INDEX IF NOT EXISTS idx_news_reactions_device ON news_reactions(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_news_reaction_counts_news ON news_reaction_counts(news_id);

-- ============================================
-- POLL VOTE FLAGS TABLE
-- ============================================

-- Track suspicious voting patterns for admin review
CREATE TABLE IF NOT EXISTS poll_vote_flags (
  id SERIAL PRIMARY KEY,
  poll_id VARCHAR(100) NOT NULL,
  voter_name VARCHAR(255) NOT NULL,
  flag_reason VARCHAR(255) NOT NULL, -- 'duplicate_name', 'rapid_voting', 'suspicious_pattern'
  device_count INTEGER DEFAULT 1,
  flagged_at TIMESTAMP DEFAULT NOW(),
  reviewed_by VARCHAR(100), -- Admin who reviewed
  reviewed_at TIMESTAMP,
  resolution VARCHAR(50), -- 'kept', 'deleted', 'verified'
  
  UNIQUE(poll_id, voter_name)
);

CREATE INDEX IF NOT EXISTS idx_poll_flags_poll ON poll_vote_flags(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_flags_unreviewed ON poll_vote_flags(poll_id) WHERE reviewed_at IS NULL;

-- ============================================
-- ADD COMMENTS
-- ============================================

COMMENT ON COLUMN poll_votes.voter_name IS 'Name entered by voter (required for anonymous voting)';
COMMENT ON COLUMN poll_votes.device_fingerprint IS 'Unique browser/device fingerprint (one device = one vote)';
COMMENT ON COLUMN poll_votes.is_flagged IS 'Flagged for admin review (duplicate name across devices)';
COMMENT ON COLUMN poll_votes.admin_verified IS 'Admin verified this vote as legitimate';

COMMENT ON TABLE news_reactions IS 'Anonymous emoji reactions on news articles';
COMMENT ON COLUMN news_reactions.reaction_type IS 'Emoji reaction: helpful, love, funny, wow, sad, angry';
COMMENT ON COLUMN news_reactions.device_fingerprint IS 'Device ID - one reaction per device per article';

COMMENT ON TABLE poll_vote_flags IS 'Tracks suspicious voting patterns for admin review';

-- ============================================
-- VERIFICATION
-- ============================================

SELECT 
  'poll_votes' as table_name, 
  COUNT(*) FILTER (WHERE device_fingerprint IS NOT NULL) as with_device_tracking
FROM poll_votes;

SELECT 
  'news_reactions' as table_name, 
  COUNT(*) as row_count 
FROM news_reactions;

SELECT 
  'poll_vote_flags' as table_name, 
  COUNT(*) as row_count 
FROM poll_vote_flags;

SELECT '✅ Device tracking and news reactions added successfully!' as status;
