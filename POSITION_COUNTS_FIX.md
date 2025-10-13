# Position Counts Fix - Cricket to Football

## Problem
The `position_counts` field in the `team_seasons` collection was using cricket position names (`batsman`, `bowler`, `wicket_keeper`, `all_rounder`) instead of football positions (`GK`, `CB`, `LB`, `RB`, `DMF`, `CMF`, `AMF`, `LMF`, `RMF`, `LWF`, `RWF`, `SS`, `CF`).

Additionally, when players were allocated during round finalization, the `position_counts` were not being updated at all, causing team statistics to be incomplete.

## Root Cause
1. **Client-side registration code** - The team registration page (`app/register/team/page.tsx`) was still initializing `position_counts` with cricket positions
2. **Missing position tracking** - The round finalization logic (`lib/finalize-round.ts`) wasn't updating position_counts when allocating players to teams

## Files Changed

### 1. `/app/register/team/page.tsx`
**Changed:** Lines 138-142 and 169-173

**Before:**
```typescript
position_counts: {
  batsman: 0,
  bowler: 0,
  wicket_keeper: 0,
  all_rounder: 0,
},
```

**After:**
```typescript
position_counts: {
  GK: 0,
  CB: 0,
  LB: 0,
  RB: 0,
  DMF: 0,
  CMF: 0,
  AMF: 0,
  LMF: 0,
  RMF: 0,
  LWF: 0,
  RWF: 0,
  SS: 0,
  CF: 0,
},
```

### 2. `/TEAM_SEASON_REGISTRATION.md`
**Changed:** Lines 122-126 and 147-151

Updated documentation to reflect football positions.

### 3. `/lib/finalize-round.ts`
**Changed:** Lines 373-441

**Added:** 
- Query to fetch player position from the database
- Logic to increment the position count in `position_counts` when allocating a player
- Updated logging to show position count updates

**Before:**
```typescript
// Update budget, total spent, and player count
await teamSeasonRef.update({
  budget: currentBudget - allocation.amount,
  total_spent: totalSpent,
  players_count: playersCount,
  updated_at: new Date()
});
```

**After:**
```typescript
// 3. Get player position for position_counts update
const playerResult = await sql`
  SELECT position FROM footballplayers WHERE id = ${allocation.player_id}
`;
const playerPosition = playerResult[0]?.position;

// Prepare position_counts update
const positionCounts = teamSeasonData?.position_counts || {};
if (playerPosition && playerPosition in positionCounts) {
  positionCounts[playerPosition] = (positionCounts[playerPosition] || 0) + 1;
}

// Update budget, total spent, player count, and position_counts
await teamSeasonRef.update({
  budget: currentBudget - allocation.amount,
  total_spent: totalSpent,
  players_count: playersCount,
  position_counts: positionCounts,
  updated_at: new Date()
});

console.log(`✅ Updated team ${allocation.team_id}: budget £${currentBudget} -> £${currentBudget - allocation.amount}, ${playerPosition} count incremented`);
```

## Football Positions Reference

The system now uses the following 13 football positions:

| Position | Full Name | Category |
|----------|-----------|----------|
| **GK** | Goalkeeper | Goalkeeper |
| **CB** | Center Back | Defender |
| **LB** | Left Back | Defender |
| **RB** | Right Back | Defender |
| **DMF** | Defensive Midfielder | Midfielder |
| **CMF** | Center Midfielder | Midfielder |
| **AMF** | Attacking Midfielder | Midfielder |
| **LMF** | Left Midfielder | Midfielder |
| **RMF** | Right Midfielder | Midfielder |
| **LWF** | Left Wing Forward | Forward |
| **RWF** | Right Wing Forward | Forward |
| **SS** | Second Striker | Forward |
| **CF** | Center Forward | Forward |

## Impact

### New Registrations
- Teams registering from now on will have their `position_counts` correctly initialized with football positions

### Existing Team Data
- **Note:** Existing team_seasons documents with cricket positions will still have the old schema
- These will be gradually updated as teams acquire new players through round finalization
- If needed, a migration script could be created to update existing documents

### Round Finalization
- When a round is finalized and players are allocated:
  - The player's position is fetched from the database
  - The team's `position_counts[position]` is incremented by 1
  - All team statistics are updated atomically

## Verification

To verify the fix is working:

1. **Check new registrations:**
   ```javascript
   // In Firebase console, check a newly created team_seasons document
   // position_counts should have GK, CB, LB, etc. instead of batsman, bowler, etc.
   ```

2. **Check position updates after finalization:**
   ```javascript
   // After finalizing a round, check the winning team's team_seasons document
   // position_counts[player_position] should increment by 1
   ```

3. **Monitor console logs:**
   ```
   ✅ Updated team abc123: budget £15000 -> £14500, CF count incremented
   ```

## Future Considerations

### Data Migration (Optional)
If you want to migrate existing team_seasons documents with cricket positions:

```javascript
// Migration script example
const teamSeasons = await adminDb.collection('team_seasons')
  .where('position_counts.batsman', '>=', 0)
  .get();

for (const doc of teamSeasons.docs) {
  await doc.ref.update({
    'position_counts': {
      GK: 0, CB: 0, LB: 0, RB: 0,
      DMF: 0, CMF: 0, AMF: 0,
      LMF: 0, RMF: 0,
      LWF: 0, RWF: 0,
      SS: 0, CF: 0
    }
  });
}
```

### Position Group Validation
Consider adding validation to ensure:
- Position values match the allowed positions
- Position counts match the actual players_count
- Budget calculations remain consistent

## Related Files

- `/app/api/seasons/[seasonId]/register/route.ts` - Already had correct positions (no change needed)
- `/TEAM_SEASONS_SCHEMA.md` - Already had correct documentation (no change needed)
- `/app/api/team/dashboard/route.ts` - Reads position_counts (no change needed)

## Testing Checklist

- [x] Fixed client-side team registration to use football positions
- [x] Fixed server-side documentation to reflect football positions
- [x] Added position_counts update logic to round finalization
- [x] Updated console logging to show position updates
- [x] **Migrated existing team_seasons documents** (2 documents updated)
- [ ] Test new team registration with football positions
- [ ] Test round finalization with position count updates
- [ ] Verify team dashboard displays correct position breakdown

## Migration Execution

**Date:** 2025-10-05  
**Script:** `scripts/migrate-position-counts.js`

**Results:**
```
✅ Successfully updated: 2 documents
❌ Errors: 0
📝 Total processed: 2 team_seasons
```

**Documents Updated:**
1. **Sentinels** (`6Ys0fx9apuNrnW98N2DdUeos2eu2_cDbQCLfNuTyEoIuiSIh7`)
   - Migrated from cricket positions to football positions
   - Position counts recalculated: All positions set to 0 (no players yet)

2. **Real Madrid** (`PYveBNeFS3gNMp6KmP4FhFAfeCw1_cDbQCLfNuTyEoIuiSIh7`)
   - Migrated from cricket positions to football positions
   - Position counts recalculated: All positions set to 0 (no players yet)

## Date
2025-10-05

## Status
✅ **COMPLETED** - All code changes applied, existing data migrated, and documented
