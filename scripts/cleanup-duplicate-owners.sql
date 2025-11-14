-- Cleanup Duplicate Owners Script
-- This script identifies and removes duplicate owner entries where the same person
-- was created twice - once with Firebase UID and once with proper team_id

-- Step 1: Identify duplicates (same email, name, phone)
-- Run this first to see what will be cleaned up
SELECT 
    o1.id as keep_id,
    o1.owner_id as keep_owner_id,
    o1.team_id as keep_team_id,
    o2.id as duplicate_id,
    o2.owner_id as duplicate_owner_id,
    o2.team_id as duplicate_team_id,
    o1.name,
    o1.email,
    o1.phone
FROM owners o1
INNER JOIN owners o2 ON 
    o1.email = o2.email 
    AND o1.name = o2.name 
    AND o1.phone = o2.phone
    AND o1.id < o2.id  -- Keep the older entry
WHERE 
    o1.team_id LIKE 'SSPSLT%'  -- Keep the one with proper team_id format
    AND o2.team_id NOT LIKE 'SSPSLT%'  -- Remove the one with Firebase UID
ORDER BY o1.name;

-- Step 2: Delete duplicates (UNCOMMENT TO EXECUTE)
-- WARNING: This will permanently delete duplicate records!
/*
DELETE FROM owners
WHERE id IN (
    SELECT o2.id
    FROM owners o1
    INNER JOIN owners o2 ON 
        o1.email = o2.email 
        AND o1.name = o2.name 
        AND o1.phone = o2.phone
        AND o1.id < o2.id
    WHERE 
        o1.team_id LIKE 'SSPSLT%'
        AND o2.team_id NOT LIKE 'SSPSLT%'
);
*/

-- Step 3: Verify cleanup (run after Step 2)
/*
SELECT 
    owner_id,
    team_id,
    name,
    email,
    phone,
    created_at
FROM owners
ORDER BY email, created_at;
*/
