-- Migration: Add manual finalization support for auction rounds
-- Database: Tournament DB (Neon)
-- Date: 2025-11-25
-- Description: Adds finalization_mode column to rounds table and creates pending_allocations table
--              to support two-step finalization process (preview then apply)

-- Step 1: Add finalization_mode column to rounds table
ALTER TABLE rounds 
ADD COLUMN IF NOT EXISTS finalization_mode VARCHAR(20) DEFAULT 'auto';

COMMENT ON COLUMN rounds.finalization_mode IS 'Controls finalization behavior: "auto" (auto-finalize on expiry) or "manual" (requires preview and manual approval)';

-- Step 2: Create pending_allocations table
-- This table stores preview finalization results before they are applied
CREATE TABLE IF NOT EXISTS pending_allocations (
    id SERIAL PRIMARY KEY,
    round_id INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
    team_id VARCHAR(255) NOT NULL,
    team_name VARCHAR(255) NOT NULL,
    player_id VARCHAR(255) NOT NULL,
    player_name VARCHAR(255) NOT NULL,
    amount INTEGER NOT NULL,
    bid_id VARCHAR(255),
    phase VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(round_id, team_id)
);

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pending_allocations_round ON pending_allocations(round_id);
CREATE INDEX IF NOT EXISTS idx_pending_allocations_team ON pending_allocations(team_id);
CREATE INDEX IF NOT EXISTS idx_pending_allocations_player ON pending_allocations(player_id);

-- Step 4: Add comments for documentation
COMMENT ON TABLE pending_allocations IS 'Stores preview finalization results before they are applied. Allows committee admins to review allocations before making them official.';
COMMENT ON COLUMN pending_allocations.round_id IS 'Reference to the auction round';
COMMENT ON COLUMN pending_allocations.team_id IS 'Team ID (readable format, e.g., SSPSLT0001)';
COMMENT ON COLUMN pending_allocations.team_name IS 'Team name for display purposes';
COMMENT ON COLUMN pending_allocations.player_id IS 'Player ID from footballplayers table';
COMMENT ON COLUMN pending_allocations.player_name IS 'Player name for display purposes';
COMMENT ON COLUMN pending_allocations.amount IS 'Bid amount in currency units';
COMMENT ON COLUMN pending_allocations.bid_id IS 'Reference to the winning bid, or synthetic ID for random allocations';
COMMENT ON COLUMN pending_allocations.phase IS 'Allocation phase: "regular" (normal auction) or "incomplete" (forced/random allocation)';
COMMENT ON COLUMN pending_allocations.created_at IS 'Timestamp when the preview was created';

-- Step 5: Verify the changes
DO $$
BEGIN
    -- Check if finalization_mode column exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'rounds' 
        AND column_name = 'finalization_mode'
    ) THEN
        RAISE NOTICE '✓ Column rounds.finalization_mode created successfully';
    ELSE
        RAISE EXCEPTION '✗ Failed to create column rounds.finalization_mode';
    END IF;

    -- Check if pending_allocations table exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_name = 'pending_allocations'
    ) THEN
        RAISE NOTICE '✓ Table pending_allocations created successfully';
    ELSE
        RAISE EXCEPTION '✗ Failed to create table pending_allocations';
    END IF;

    -- Check if indexes exist
    IF EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE tablename = 'pending_allocations' 
        AND indexname = 'idx_pending_allocations_round'
    ) THEN
        RAISE NOTICE '✓ Index idx_pending_allocations_round created successfully';
    ELSE
        RAISE EXCEPTION '✗ Failed to create index idx_pending_allocations_round';
    END IF;

    RAISE NOTICE '✓ Migration completed successfully';
END $$;
