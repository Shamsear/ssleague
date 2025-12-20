# Fantasy Passive Points Fix

## Issue
The `recalculate-all-fantasy-points.js` script was not correctly including admin bonus points in the `passive_points` column of the `fantasy_teams` table.

### What Was Happening
- Passive bonuses from `fantasy_team_bonus_points` were calculated correctly (e.g., 52 points)
- Admin bonuses from `bonus_points` table were calculated correctly (e.g., 5 points)
- Admin bonuses were added to `total_points` ✅
- **BUT** admin bonuses were NOT added to `passive_points` ❌

This caused the passive points display to show 52 instead of 57 (52 + 5).

## Root Cause
In **STEP 4** of `scripts/recalculate-all-fantasy-points.js`, the script was:
1. Querying admin bonus points correctly
2. Adding them to the total points calculation
3. **But NOT updating the `passive_points` column to include them**

### Before (Buggy Code)
```javascript
const playerPoints = Number(pointsResult[0].player_points);
const passivePoints = Number(teamInfo[0].passive_points);
const adminBonusPoints = Number(teamBonusPoints[0].bonus_points);
const calculatedTotal = playerPoints + passivePoints + adminBonusPoints;

await fantasyDb`
  UPDATE fantasy_teams
  SET 
    player_points = ${playerPoints},
    total_points = ${calculatedTotal},  // ❌ passive_points not updated
    updated_at = NOW()
  WHERE team_id = ${team.team_id}
`;
```

### After (Fixed Code)
```javascript
const playerPoints = Number(pointsResult[0].player_points);
const passivePointsFromBonuses = Number(teamInfo[0].passive_points);
const adminBonusPoints = Number(teamBonusPoints[0].bonus_points);
const totalPassivePoints = passivePointsFromBonuses + adminBonusPoints;  // ✅ Combined
const calculatedTotal = playerPoints + totalPassivePoints;

await fantasyDb`
  UPDATE fantasy_teams
  SET 
    player_points = ${playerPoints},
    passive_points = ${totalPassivePoints},  // ✅ Now includes admin bonuses
    total_points = ${calculatedTotal},
    updated_at = NOW()
  WHERE team_id = ${team.team_id}
`;
```

## What Was Fixed

### 1. Updated `recalculate-all-fantasy-points.js`
- Modified STEP 4 to correctly calculate `totalPassivePoints = passivePointsFromBonuses + adminBonusPoints`
- Updated the `passive_points` column in the database to include both types of bonuses

### 2. Created Helper Scripts
- `scripts/fix-fc-barcelona-passive-points.js` - Diagnoses and fixes a specific team
- `scripts/fix-all-teams-passive-points.js` - Fixes all teams at once
- `scripts/test-passive-points-fix.js` - Tests the fix

## Passive Points Breakdown

Passive points now correctly include:

1. **Team Performance Bonuses** (from `fantasy_team_bonus_points`)
   - Win bonuses
   - Clean sheet bonuses
   - High scoring bonuses
   - Goal margin bonuses
   - Calculated automatically when fixtures are completed

2. **Admin Bonus Points** (from `bonus_points` table)
   - Manually awarded by admins
   - Examples: "Team of the Day", special achievements
   - Stored with `target_type = 'team'` and `target_id = supported_team_id`

## Example: FC Barcelona

### Before Fix
```
Passive Bonuses (from fantasy_team_bonus_points): 52
Admin Bonuses (from bonus_points): 5
Displayed Passive Points: 52  ❌ Missing admin bonus
Total Points: 411 ✅ (Correct, but breakdown was wrong)
```

### After Fix
```
Passive Bonuses (from fantasy_team_bonus_points): 52
Admin Bonuses (from bonus_points): 5
Displayed Passive Points: 57  ✅ Includes admin bonus
Total Points: 411 ✅ (Same, but now breakdown is correct)
```

## How to Use

### Run Full Recalculation
```bash
node scripts/recalculate-all-fantasy-points.js
```
This will now correctly include admin bonuses in passive points.

### Fix All Teams Immediately
```bash
node scripts/fix-all-teams-passive-points.js
```
This quickly fixes all teams without recalculating everything.

### Check Specific Team
```bash
node scripts/fix-fc-barcelona-passive-points.js
```
Modify the team name in the script to check any team.

## Verification

Run this query to verify passive points are correct:
```sql
SELECT 
  ft.team_name,
  ft.passive_points as displayed_passive,
  COALESCE(SUM(ftbp.total_bonus), 0) as team_bonuses,
  COALESCE(SUM(bp.points), 0) as admin_bonuses,
  COALESCE(SUM(ftbp.total_bonus), 0) + COALESCE(SUM(bp.points), 0) as expected_passive
FROM fantasy_teams ft
LEFT JOIN fantasy_team_bonus_points ftbp ON ftbp.team_id = ft.team_id
LEFT JOIN bonus_points bp 
  ON bp.target_type = 'team' 
  AND bp.target_id = ft.supported_team_id 
  AND bp.league_id = ft.league_id
GROUP BY ft.team_id, ft.team_name, ft.passive_points
HAVING ft.passive_points != COALESCE(SUM(ftbp.total_bonus), 0) + COALESCE(SUM(bp.points), 0);
```

If this returns no rows, all teams are correct! ✅

## Status
✅ **FIXED** - All teams now correctly display passive points including admin bonuses.

## Teams Affected
- FC Barcelona: 52 → 57 (+5 admin bonus)
- Psychoz: 52 → 57 (+5 admin bonus)  
- Blue Strikers: 46 → 51 (+5 admin bonus)

All other teams had no admin bonuses and were already correct.
