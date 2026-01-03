-- Add unique constraint to poll_votes to prevent duplicate votes
-- This ensures one user can only vote once per poll

-- First, remove any existing duplicate votes (keep the first vote)
DELETE FROM poll_votes a
USING poll_votes b
WHERE a.id > b.id
  AND a.poll_id = b.poll_id
  AND a.user_id = b.user_id
  AND a.deleted_at IS NULL
  AND b.deleted_at IS NULL;

-- Add unique constraint on (poll_id, user_id) where deleted_at IS NULL
-- This allows the same user to vote again if their previous vote was deleted
CREATE UNIQUE INDEX IF NOT EXISTS idx_poll_votes_unique_user_poll 
  ON poll_votes(poll_id, user_id) 
  WHERE deleted_at IS NULL;

-- Add comment
COMMENT ON INDEX idx_poll_votes_unique_user_poll IS 'Ensures one user can only vote once per poll (excluding deleted votes)';

-- Verify the constraint
SELECT 
  'poll_votes unique constraint added' as status,
  COUNT(*) as total_votes,
  COUNT(DISTINCT (poll_id, user_id)) as unique_user_poll_combinations
FROM poll_votes
WHERE deleted_at IS NULL;
