# Fantasy Points Recalculation Guide

## Current Situation

The fantasy player points shown in the player leaderboard are incorrect because they need to be calculated from actual match performance data.

## Data Location

- **Fixture Matchups**: Stored in Firebase Firestore (`fixture_matchups` collection)
- **Player Points**: Should be stored in `realplayer` table in Neon (or Firebase)
- **MOTM**: Stored in `fixtures` collection in Firebase

## Points Calculation Formula

```javascript
const SCORING_RULES = {
  goal: 5,              // Points per goal scored
  clean_sheet: 4,       // Points for clean sheet (0 goals conceded)
  motm: 3,              // Points for Man of the Match
  win: 2,               // Points for winning the match
  draw: 1,              // Points for drawing the match
  appearance: 1,        // Points just for playing
};
```

### For each player in each match:
```
Base Points = 
  (goals × 5) +
  (clean_sheet ? 4 : 0) +
  (is_motm ? 3 : 0) +
  (won ? 2 : draw ? 1 : 0) +
  1 (appearance)
```

### With Captain/Vice-Captain Multipliers (for Fantasy Teams):
- Captain: Base Points × 2
- Vice-Captain: Base Points × 1.5
- Regular: Base Points × 1

## Implementation Options

### Option 1: Create API Endpoint (Recommended)

Create `/api/admin/recalculate-fantasy-points` that:
1. Fetches all completed fixtures from Firebase
2. For each fixture, gets matchup data
3. Calculates points for each player
4. Updates `realplayer` table or creates `player_stats` table

### Option 2: Manual Calculation Script

Since matchup data is in Firebase, the script needs to:
1. Connect to Firebase
2. Query `fixture_matchups` collection
3. Calculate points
4. Update database

## Recommended Approach

1. **Create an admin API endpoint** at `/api/admin/fantasy/recalculate-points`
2. **Add a button** in the committee dashboard to trigger recalculation
3. **Show progress** and results to the admin

## Example API Implementation

```typescript
// app/api/admin/fantasy/recalculate-points/route.ts
export async function POST(request: NextRequest) {
  // 1. Get all fixtures from Firebase
  const fixturesSnapshot = await getDocs(
    query(collection(db, 'fixtures'), where('status', '==', 'completed'))
  );
  
  // 2. For each fixture, get matchups
  for (const fixtureDoc of fixturesSnapshot.docs) {
    const matchupsSnapshot = await getDocs(
      collection(db, 'fixture_matchups'),
      where('fixture_id', '==', fixtureDoc.id)
    );
    
    // 3. Calculate points for each player
    // 4. Store in database
  }
  
  return NextResponse.json({ success: true });
}
```

## Quick Fix for Display

For now, to show correct points in the player leaderboard:

1. Calculate points on-the-fly from Firebase matchup data
2. Or create a one-time calculation and store results
3. Or add a "Recalculate Points" button for admins

## Next Steps

1. Decide where to store calculated points (Neon `realplayer` table or new `player_stats` table)
2. Create the recalculation API endpoint
3. Add admin UI to trigger recalculation
4. Update player leaderboard to show correct points
