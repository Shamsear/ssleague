-- Script to identify and fix duplicate salary deductions from match rewards
-- Run this to find and reverse duplicate transactions

-- STEP 1: Identify duplicate match reward transactions
-- This finds transactions that were created at the same time (within 1 minute) for the same team
SELECT 
  t1.id as transaction_id,
  t1.team_id,
  t1.description,
  t1.amount_football,
  t1.amount_real,
  t1.created_at,
  COUNT(*) OVER (PARTITION BY t1.team_id, DATE_TRUNC('minute', t1.created_at), t1.description) as duplicate_count
FROM transactions t1
WHERE t1.transaction_type = 'match_reward'
  AND t1.created_at >= '2024-12-16 00:00:00'  -- Adjust date as needed
ORDER BY t1.team_id, t1.created_at DESC;

-- STEP 2: Find specific duplicates (transactions with same description within 5 minutes)
WITH duplicate_transactions AS (
  SELECT 
    t1.id as id1,
    t2.id as id2,
    t1.team_id,
    t1.description,
    t1.amount_football,
    t1.amount_real,
    t1.created_at as time1,
    t2.created_at as time2,
    ABS(EXTRACT(EPOCH FROM (t1.created_at - t2.created_at))) as seconds_apart
  FROM transactions t1
  JOIN transactions t2 ON 
    t1.team_id = t2.team_id 
    AND t1.description = t2.description
    AND t1.transaction_type = 'match_reward'
    AND t2.transaction_type = 'match_reward'
    AND t1.id < t2.id  -- Avoid duplicates in results
    AND ABS(EXTRACT(EPOCH FROM (t1.created_at - t2.created_at))) < 300  -- Within 5 minutes
  WHERE t1.created_at >= '2024-12-16 00:00:00'
)
SELECT * FROM duplicate_transactions
ORDER BY team_id, time1;

-- STEP 3: Reverse the duplicate transactions (MANUAL - Review first!)
-- For each duplicate found above, create a reversal transaction

-- Example reversal for a specific transaction:
-- INSERT INTO transactions (
--   team_id,
--   season_id,
--   transaction_type,
--   amount_football,
--   amount_real,
--   description,
--   created_at
-- ) VALUES (
--   'TEAM_ID_HERE',
--   'SEASON_ID_HERE',
--   'adjustment',
--   -0.63,  -- Negative of the duplicate amount
--   0,
--   'Reversal: Duplicate salary deduction - Match Reward (Win) - Round X',
--   NOW()
-- );

-- STEP 4: Update team balances (after creating reversal transactions)
-- This recalculates the correct balance based on all transactions

-- For a specific team:
-- UPDATE teams
-- SET 
--   football_budget = (
--     SELECT COALESCE(SUM(amount_football), 0)
--     FROM transactions
--     WHERE team_id = 'TEAM_ID_HERE'
--   ),
--   real_budget = (
--     SELECT COALESCE(SUM(amount_real), 0)
--     FROM transactions
--     WHERE team_id = 'TEAM_ID_HERE'
--   )
-- WHERE id = 'TEAM_ID_HERE';

-- STEP 5: Verify the fix
-- Check team balances match transaction totals
SELECT 
  t.id as team_id,
  t.team_name,
  t.football_budget as current_football_budget,
  t.real_budget as current_real_budget,
  COALESCE(SUM(tr.amount_football), 0) as calculated_football_budget,
  COALESCE(SUM(tr.amount_real), 0) as calculated_real_budget,
  t.football_budget - COALESCE(SUM(tr.amount_football), 0) as football_difference,
  t.real_budget - COALESCE(SUM(tr.amount_real), 0) as real_difference
FROM teams t
LEFT JOIN transactions tr ON t.id = tr.team_id
WHERE t.season_id = 'YOUR_SEASON_ID'  -- Adjust as needed
GROUP BY t.id, t.team_name, t.football_budget, t.real_budget
HAVING 
  ABS(t.football_budget - COALESCE(SUM(tr.amount_football), 0)) > 0.01
  OR ABS(t.real_budget - COALESCE(SUM(tr.amount_real), 0)) > 0.01
ORDER BY t.team_name;
