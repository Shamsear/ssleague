-- Fix duplicate owners issue
-- This migration prevents the same Firebase user from having multiple owner records

-- Step 1: Identify and keep only the latest owner record for each registered_user_id
-- (Keeping the one with the highest ID as it's likely the most recent)

-- First, let's see what duplicates exist
SELECT 
    registered_user_id,
    COUNT(*) as count,
    STRING_AGG(owner_id::text, ', ') as owner_ids,
    STRING_AGG(team_id::text, ', ') as team_ids
FROM owners
WHERE registered_user_id IS NOT NULL
GROUP BY registered_user_id
HAVING COUNT(*) > 1;

-- Step 2: Delete duplicate owners, keeping only the latest one per user
-- WARNING: Review the output of Step 1 before running this!
WITH ranked_owners AS (
    SELECT 
        id,
        owner_id,
        registered_user_id,
        ROW_NUMBER() OVER (
            PARTITION BY registered_user_id 
            ORDER BY id DESC
        ) as rn
    FROM owners
    WHERE registered_user_id IS NOT NULL
)
DELETE FROM owners
WHERE id IN (
    SELECT id FROM ranked_owners WHERE rn > 1
);

-- Step 3: Add unique constraint on registered_user_id to prevent future duplicates
-- This allows NULL values but ensures non-NULL values are unique
CREATE UNIQUE INDEX IF NOT EXISTS idx_owners_registered_user_id_unique 
ON owners (registered_user_id) 
WHERE registered_user_id IS NOT NULL;

-- Step 4: Verify the cleanup
SELECT 
    registered_user_id,
    COUNT(*) as count,
    STRING_AGG(owner_id::text, ', ') as owner_ids
FROM owners
WHERE registered_user_id IS NOT NULL
GROUP BY registered_user_id
HAVING COUNT(*) > 1;

-- Should return no rows if cleanup was successful
