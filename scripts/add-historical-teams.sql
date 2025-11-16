-- Add Historical Teams to Neon Database
-- This adds all historical teams from Firebase that are not currently in Neon
-- with their final/latest names so the team name resolver works correctly

-- Example teams with name changes (you'll need to verify these):
INSERT INTO teams (team_uid, team_name, is_active, created_at, updated_at)
VALUES
  -- Teams that participated in S1-S15 but not S16
  ('SSPSLT0002', 'Team Name 2', false, NOW(), NOW()),
  ('SSPSLT0003', 'Team Name 3', false, NOW(), NOW()),
  ('SSPSLT0005', 'Team Name 5', false, NOW(), NOW()),
  ('SSPSLT0007', 'Team Name 7', false, NOW(), NOW()),
  ('SSPSLT0008', 'Team Name 8', false, NOW(), NOW()),
  ('SSPSLT0010', 'Team Name 10', false, NOW(), NOW()),
  ('SSPSLT0011', 'Team Name 11', false, NOW(), NOW()),
  ('SSPSLT0012', 'Team Name 12', false, NOW(), NOW()),
  ('SSPSLT0014', 'Team Name 14', false, NOW(), NOW()),
  ('SSPSLT0017', 'Team Name 17', false, NOW(), NOW()),
  ('SSPSLT0018', 'Team Name 18', false, NOW(), NOW()),
  ('SSPSLT0019', 'Team Name 19', false, NOW(), NOW()),
  ('SSPSLT0020', 'Team Name 20', false, NOW(), NOW()),
  ('SSPSLT0021', 'Team Name 21', false, NOW(), NOW()),
  ('SSPSLT0022', 'Team Name 22', false, NOW(), NOW()),
  ('SSPSLT0023', 'Team Name 23', false, NOW(), NOW()),
  ('SSPSLT0024', 'Team Name 24', false, NOW(), NOW()),
  ('SSPSLT0025', 'Team Name 25', false, NOW(), NOW()),
  ('SSPSLT0027', 'Team Name 27', false, NOW(), NOW()),
  ('SSPSLT0028', 'Team Name 28', false, NOW(), NOW())
ON CONFLICT (team_uid) DO NOTHING;

-- Check what was added
SELECT team_uid, team_name, is_active 
FROM teams 
WHERE is_active = false
ORDER BY team_name;

-- NOTE: Replace 'Team Name X' with actual team names from Firebase
-- You need to manually find the final names for each team_uid
