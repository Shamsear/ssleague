# Fantasy Points Calculation Fix - Summary

## Issues Found and Fixed

### 1. Duplicate Records Issue ✅ FIXED
**Problem:** The `fantasy_player_points` table had duplicate records for the same player in the same fixture.

**Example:**
- Muhammed Fijas in Psychoz had **336 points** (should be 188)
- Rounds 2, 3, and 4 each had **2 duplicate records**
- This caused points to be counted twice

**Solution:**
- Created `scripts/fix-duplicate-fantasy-points.js` to remove duplicates
- Removed **119 duplicate records** across all teams
- Updated recalculation scripts to check for existing records before inserting

**Result:**
- Psychoz: 610 pts → 345 pts (correct)
- Muhammed Fijas: 336 pts → 188 pts (correct)

### 2. UI Display Bug ✅ FIXED
**Problem:** The UI was showing incorrect captain/vice-captain labels in the match-by-match breakdown.

**Root Cause:**
- The code was checking `match.is_captain` field
- But `is_captain` is set to `true` for BOTH captain and vice-captain (it just means "has multiplier")
- The correct field to check is `points_multiplier`:
  - `200` = Captain (2x)
  - `150` = Vice-Captain (1.5x)
  - `100` = Regular (1x)

**Files Fixed:**
1. `app/dashboard/team/fantasy/all-teams/page.tsx`
2. `app/dashboard/committee/fantasy/teams/[leagueId]/page.tsx`
3. `components/fantasy/PlayerBreakdownModal.tsx`

**Change Made:**
```typescript
// BEFORE (Wrong)
{match.is_captain ? (
  <>Captain Multiplier</>
) : (
  <>Vice-Captain Multiplier</>
)}

// AFTER (Correct)
{match.points_multiplier === 200 || multiplier === 2 ? (
  <>Captain Multiplier</>
) : (
  <>Vice-Captain Multiplier</>
)}
```

### 3. Recalculation Script Improvements ✅ FIXED
**Problem:** The recalculation scripts were creating duplicate records.

**Solution:**
- Updated `scripts/recalculate-all-fantasy-points.js`
- Updated `app/api/admin/fantasy/recalculate-all-points/route.ts`
- Added duplicate check BEFORE inserting each record

**Change Made:**
```javascript
// Check if record already exists to prevent duplicates
const existing = await fantasyDb`
  SELECT id FROM fantasy_player_points
  WHERE team_id = ${teamInfo.teamId}
    AND real_player_id = ${playerId}
    AND fixture_id = ${matchup.fixture_id}
  LIMIT 1
`;

if (existing.length === 0) {
  // Only insert if doesn't exist
  await fantasyDb`INSERT INTO fantasy_player_points ...`;
}
```

## Verification

### Database State After Fix
Muhammed Fijas (sspslpsl0020) appears in **6 teams** with correct points:

| Team | Role | Points | Calculation |
|------|------|--------|-------------|
| FC Barcelona | Captain | 188 pts | 20+18+26+30 = 94 × 2 = 188 ✅ |
| Legends FC | Vice-Captain | 141 pts | 20+18+26+30 = 94 × 1.5 = 141 ✅ |
| Psychoz | Captain | 188 pts | 20+18+26+30 = 94 × 2 = 188 ✅ |
| Red Hawks FC | Regular | 94 pts | 20+18+26+30 = 94 × 1 = 94 ✅ |
| Skill 555 | Captain | 188 pts | 20+18+26+30 = 94 × 2 = 188 ✅ |
| Varsity Soccers | Captain | 188 pts | 20+18+26+30 = 94 × 2 = 188 ✅ |

**Base Points per Round:**
- R1: 20 pts (3 goals, 1 conceded, win, MOTM)
- R2: 18 pts (6 goals, 4 conceded, win, hat-trick, -3 for conceding 4+)
- R3: 26 pts (6 goals, 2 conceded, win, MOTM, hat-trick)
- R4: 30 pts (5 goals, 0 conceded, win, MOTM, clean sheet, hat-trick)
- **Total Base: 94 pts**

### Final Team Standings
After fixing duplicates:

1. **FC Barcelona**: 368 pts (Player: 348, Passive: 20)
2. **Legends FC**: 361 pts (Player: 346, Passive: 15)
3. **Varsity Soccers**: 347 pts (Player: 346, Passive: 1)
4. **Skill 555**: 346 pts (Player: 331, Passive: 15)
5. **Psychoz**: 345 pts (Player: 325, Passive: 20)
6. **Blue Strikers**: 309 pts (Player: 294, Passive: 15)
7. **Los Blancos**: 302 pts (Player: 293, Passive: 9)
8. **Red Hawks FC**: 285 pts (Player: 283, Passive: 2)

## Scripts Created

### 1. `scripts/diagnose-fantasy-points.js`
- Diagnoses fantasy points issues
- Checks for duplicates
- Verifies calculations
- Shows detailed breakdown

### 2. `scripts/fix-duplicate-fantasy-points.js`
- Removes duplicate records
- Recalculates squad totals
- Recalculates team totals
- Updates ranks

### 3. `scripts/recalculate-all-fantasy-points.js` (Updated)
- Combined recalculation script
- Now prevents duplicates
- Handles all 4 recalculation steps

## How to Use

### If You See Duplicate Points Again:
```bash
node scripts/fix-duplicate-fantasy-points.js
```

### To Diagnose Issues:
```bash
node scripts/diagnose-fantasy-points.js
```

### To Recalculate Everything:
```bash
node scripts/recalculate-all-fantasy-points.js
```

Or use the admin page:
```
/dashboard/committee/fantasy/recalculate
```

## Prevention

The following measures are now in place to prevent duplicates:

1. ✅ Duplicate check before inserting in recalculation script
2. ✅ Duplicate check before inserting in API route
3. ✅ Unique constraint on database (team_id, real_player_id, fixture_id)
4. ✅ UI now correctly displays captain/VC based on multiplier value

## Testing

To verify the fix is working:

1. Check a player's points in the UI
2. Verify the match-by-match breakdown shows correct multipliers
3. Verify the total matches the sum of individual matches
4. Check that captain shows "2x" and vice-captain shows "1.5x"

## Conclusion

All fantasy points calculation errors have been fixed:
- ✅ Duplicate records removed (119 duplicates)
- ✅ UI displays correct captain/VC labels
- ✅ Recalculation scripts prevent future duplicates
- ✅ All team standings are now accurate
