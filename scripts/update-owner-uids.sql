-- Manual update script for fantasy team owner UIDs
-- Replace the UIDs below with the actual Firebase UIDs from the teams collection

-- Update Titans FC (SSPSLT0018)
-- Find the UID from Firebase: teams/SSPSLT0018/uid
UPDATE fantasy_teams 
SET owner_uid = 'REPLACE_WITH_RUKSHAN_FIREBASE_UID',
    updated_at = NOW()
WHERE team_id = 'SSPSLT0018';

-- Update Classic Tens (SSPSLT0001)  
-- Find the UID from Firebase: teams/SSPSLT0001/uid
UPDATE fantasy_teams 
SET owner_uid = 'REPLACE_WITH_AKSHAY_FIREBASE_UID',
    updated_at = NOW()
WHERE team_id = 'SSPSLT0001';

-- Update Red Panthers (SSPSLT0003)
-- Find the UID from Firebase: teams/SSPSLT0003/uid
UPDATE fantasy_teams 
SET owner_uid = 'REPLACE_WITH_SHINTO_FIREBASE_UID',
    updated_at = NOW()
WHERE team_id = 'SSPSLT0003';

-- Verify the updates
SELECT team_id, real_team_name, owner_uid, owner_name 
FROM fantasy_teams 
WHERE team_id IN ('SSPSLT0018', 'SSPSLT0001', 'SSPSLT0003');
