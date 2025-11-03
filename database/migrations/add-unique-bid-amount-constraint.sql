-- Migration: Add unique constraint to prevent duplicate bid amounts per team per round
-- This ensures each team can only have one bid with a specific amount in each round
-- Prevents race conditions and ensures bid uniqueness at database level

-- Add unique constraint (only for active bids)
-- Note: PostgreSQL doesn't support partial unique constraints directly with standard syntax
-- So we create a unique index with a WHERE clause instead

CREATE UNIQUE INDEX IF NOT EXISTS unique_team_round_amount_active 
ON bids (team_id, round_id, amount) 
WHERE status = 'active';

-- This index will:
-- 1. Prevent a team from placing two bids with the same amount in the same round
-- 2. Only apply to 'active' bids (won/lost bids can have duplicate amounts)
-- 3. Automatically reject duplicate inserts at database level (fast!)
-- 4. Return error code 23505 for unique constraint violations
