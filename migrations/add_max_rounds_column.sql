-- Add missing max_rounds column to auction_settings table
-- This column was referenced in the API but missing from the database schema

-- Check if the column exists before adding it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'auction_settings' 
        AND column_name = 'max_rounds'
    ) THEN
        ALTER TABLE auction_settings 
        ADD COLUMN max_rounds INTEGER NOT NULL DEFAULT 25;
        
        RAISE NOTICE 'Column max_rounds added successfully';
    ELSE
        RAISE NOTICE 'Column max_rounds already exists';
    END IF;
END $$;

-- Verify the column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'auction_settings';
