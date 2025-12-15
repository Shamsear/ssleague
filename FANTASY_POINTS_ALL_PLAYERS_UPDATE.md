# Fantasy Points - All Players Update

## Summary
Updated the fantasy points system to award points to ALL players in a squad, not just "starting" players. Removed the `is_starting` column from the database.

## Changes Made

### 1. Database Migration
**File:** `migrations/add_fantasy_round_tracking_simple.sql`

```sql
-- Remove is_starting from fantasy_squad (not needed - all players play)
ALTER TABLE fantasy_squad 
DROP COLUMN IF EXISTS is_starting;
```

✅ Already included in the migration file

### 2. API Updates

#### `app/api/fantasy/squad/route.ts`
**Before:**
```sql
SELECT is_starting, is_captain, is_vice_captain ...
ORDER BY is_starting DESC NULLS LAST, is_captain DESC ...
```

**After:**
```sql
SELECT is_captain, is_vice_captain ...
ORDER BY is_captain DESC NULLS LAST, is_vice_captain DESC ...
```

✅ Removed `is_starting` from query
✅ Updated ORDER BY to prioritize captain/VC

#### `app/api/fantasy/squad/set-captain/route.ts`
**Before:**
```typescript
if (!captain[0].is_starting) {
  return NextResponse.json(
    { error: 'Captain must be in your starting lineup...' },
    { status: 400 }
  );
}
```

**After:**
```typescript
// Removed is_starting validation
// Captain can be any player in squad
```

✅ Removed validation that captain must be in starting lineup
✅ Removed validation that vice-captain must be in starting lineup

#### `app/api/fantasy/calculate-points/route.ts`
**Before:**
```sql
SELECT team_id
FROM fantasy_squad
WHERE league_id = ${fantasy_league_id}
  AND real_player_id = ${player_id}
  AND is_starting = true  -- Only starting players
```

**After:**
```sql
SELECT team_id, is_captain, is_vice_captain
FROM fantasy_squad
WHERE league_id = ${fantasy_league_id}
  AND real_player_id = ${player_id}
  -- No is_starting filter - ALL players earn points
```

✅ Removed `is_starting = true` filter
✅ Now fetches captain/VC status directly in query
✅ All players in squad automatically earn points

### 3. Points Calculation Logic

**How it works now:**

1. **Get all teams that own the player** (no is_starting filter)
2. **For each team:**
   - Calculate base points from performance
   - Check if player is captain → multiply by 2
   - Check if player is vice-captain → multiply by 1.5
   - Otherwise → multiply by 1 (normal points)
3. **Store points** with captain/VC status recorded

**Example:**
```
Player scores 2 goals = 10 base points

Team A (player is captain):
  10 × 2 = 20 points

Team B (player is vice-captain):
  10 × 1.5 = 15 points

Team C (player is regular):
  10 × 1 = 10 points
```

## Benefits

✅ **Simpler System**: No need to select starting 5
✅ **All Players Contribute**: Every player in squad earns points
✅ **Captain/VC Still Matter**: 2x and 1.5x multipliers still apply
✅ **Less Confusion**: No "bench" vs "starting" distinction
✅ **Easier Management**: Just draft players and set captain/VC

## Database State After Migration

### `fantasy_squad` table
**Columns:**
- ✅ `is_captain` - Captain gets 2x points
- ✅ `is_vice_captain` - Vice-captain gets 1.5x points
- ❌ ~~`is_starting`~~ - REMOVED

### `fantasy_player_points` table
**Columns:**
- ✅ `is_captain` - Records if player was captain when points calculated
- ✅ `is_vice_captain` - Records if player was VC when points calculated
- ✅ `points_multiplier` - Stores the multiplier used (100, 150, or 200)
- ✅ `fantasy_round_id` - Links to specific round

## Testing Checklist

- [ ] Apply migration: `psql $DATABASE_URL -f migrations/add_fantasy_round_tracking_simple.sql`
- [ ] Verify `is_starting` column removed from `fantasy_squad`
- [ ] Draft players and verify all show in squad
- [ ] Set captain and vice-captain (no starting lineup required)
- [ ] Calculate points for a fixture
- [ ] Verify ALL squad players receive points
- [ ] Verify captain gets 2x points
- [ ] Verify vice-captain gets 1.5x points
- [ ] Verify regular players get 1x points
- [ ] Check `fantasy_player_points` table has correct multipliers

## Migration Command

```bash
# Apply the migration
psql $DATABASE_URL -f migrations/add_fantasy_round_tracking_simple.sql

# Verify is_starting is removed
psql $DATABASE_URL -c "\d fantasy_squad"
```

## Rollback (if needed)

If you need to rollback:

```sql
-- Add is_starting back (not recommended)
ALTER TABLE fantasy_squad 
ADD COLUMN is_starting BOOLEAN DEFAULT true;

-- Set all players as starting
UPDATE fantasy_squad SET is_starting = true;
```

## Notes

- Existing captain/VC selections are preserved
- Existing points data is preserved
- No data loss during migration
- System is backward compatible (old points still valid)
