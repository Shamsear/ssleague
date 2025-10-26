# Fixture Deletion & Stats Reversion Guide

## Problem
When fixtures are deleted, player stats (points, goals, wins/losses) remain in the database and are not automatically reverted.

## Solution
Two new API endpoints have been created to properly revert stats when deleting fixtures:

---

## API Endpoints

### 1. Revert Fixture Stats
**Endpoint:** `/api/realplayers/revert-fixture-stats`
**Method:** POST

Reverts match statistics (goals, wins/draws/losses, MOTM) from `realplayerstats`.

**Request Body:**
```json
{
  "season_id": "SSPSLS16",
  "fixture_id": "fixture_123",
  "matchups": [
    {
      "home_player_id": "sspslpsl0002",
      "home_player_name": "ANSIL",
      "away_player_id": "sspslpsl0003",
      "away_player_name": "RENIL",
      "home_goals": 3,
      "away_goals": 2
    }
  ]
}
```

**What it does:**
- Removes the fixture from `processed_fixtures` array
- Decrements `matches_played` by 1
- Subtracts goals_scored and goals_conceded
- Subtracts wins/draws/losses
- Subtracts MOTM awards if applicable

---

### 2. Revert Fixture Points
**Endpoint:** `/api/realplayers/revert-fixture-points`
**Method:** POST

Reverts points changes and recalculates star ratings & categories.

**Request Body:**
```json
{
  "fixture_id": "fixture_123",
  "season_id": "SSPSLS16",
  "matchups": [
    {
      "home_player_id": "sspslpsl0002",
      "away_player_id": "sspslpsl0003",
      "home_goals": 3,
      "away_goals": 2
    }
  ]
}
```

**What it does:**
- Calculates the original GD and points change
- **Subtracts** those points from player's lifetime total
- Recalculates star rating from new points
- Recalculates salary if star rating changed
- Updates `realplayerstats` season points
- **Recalculates categories for ALL players** (league-wide ranking)

---

## Complete Fixture Deletion Workflow

When deleting a fixture, follow this order:

### Step 1: Get Matchup Data
Before deleting, fetch the matchup data from the fixture:

```javascript
// GET matchups
const matchupsResponse = await fetch(`/api/fixtures/${fixtureId}/matchups`);
const { matchups } = await matchupsResponse.json();

// GET fixture details
const fixtureResponse = await fetch(`/api/fixtures/${fixtureId}`);
const { fixture } = await fixtureResponse.json();
const seasonId = fixture.season_id;
```

### Step 2: Revert Player Stats
```javascript
await fetch('/api/realplayers/revert-fixture-stats', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    season_id: seasonId,
    fixture_id: fixtureId,
    matchups: matchups
  })
});
```

### Step 3: Revert Player Points
```javascript
await fetch('/api/realplayers/revert-fixture-points', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fixture_id: fixtureId,
    season_id: seasonId,
    matchups: matchups
  })
});
```

### Step 4: Delete Matchups
```javascript
// Delete from matchups table
await sql`DELETE FROM matchups WHERE fixture_id = ${fixtureId}`;
```

### Step 5: Delete Fixture
```javascript
// Delete from fixtures table
await sql`DELETE FROM fixtures WHERE id = ${fixtureId}`;
```

---

## Example Implementation

### Create DELETE endpoint: `/app/api/fixtures/[fixtureId]/delete/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_DATABASE_URL!);

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  try {
    const { fixtureId } = await params;

    // 1. Get fixture data
    const fixtures = await sql`SELECT * FROM fixtures WHERE id = ${fixtureId}`;
    if (fixtures.length === 0) {
      return NextResponse.json({ error: 'Fixture not found' }, { status: 404 });
    }
    const fixture = fixtures[0];
    const seasonId = fixture.season_id;

    // 2. Get matchups
    const matchups = await sql`SELECT * FROM matchups WHERE fixture_id = ${fixtureId}`;

    if (matchups.length > 0) {
      // 3. Revert stats (call internal functions or use fetch)
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/realplayers/revert-fixture-stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season_id: seasonId,
          fixture_id: fixtureId,
          matchups: matchups.map(m => ({
            home_player_id: m.home_player_id,
            home_player_name: m.home_player_name,
            away_player_id: m.away_player_id,
            away_player_name: m.away_player_name,
            home_goals: m.home_goals,
            away_goals: m.away_goals,
          }))
        })
      });

      // 4. Revert points
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/realplayers/revert-fixture-points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fixture_id: fixtureId,
          season_id: seasonId,
          matchups: matchups.map(m => ({
            home_player_id: m.home_player_id,
            away_player_id: m.away_player_id,
            home_goals: m.home_goals,
            away_goals: m.away_goals,
          }))
        })
      });
    }

    // 5. Delete matchups
    await sql`DELETE FROM matchups WHERE fixture_id = ${fixtureId}`;

    // 6. Delete fixture
    await sql`DELETE FROM fixtures WHERE id = ${fixtureId}`;

    return NextResponse.json({
      success: true,
      message: 'Fixture deleted and stats reverted successfully'
    });
  } catch (error) {
    console.error('Error deleting fixture:', error);
    return NextResponse.json(
      { error: 'Failed to delete fixture' },
      { status: 500 }
    );
  }
}
```

---

## Important Notes

### ✅ What Gets Reverted:
1. **realplayerstats (season-specific)**
   - matches_played (-1)
   - goals_scored/conceded (subtracted)
   - wins/draws/losses (subtracted)
   - MOTM awards (subtracted if applicable)
   - Fixture removed from `processed_fixtures` array

2. **realplayer (lifetime)**
   - points (subtracted based on GD)
   - star_rating (recalculated from new points)
   - category_id/category_name (recalculated league-wide)
   - salary_per_match (recalculated if star rating changed)

3. **League-Wide Impact**
   - ALL player categories are recalculated
   - Rankings shift based on new points distribution
   - Top 50% = Legend, Bottom 50% = Classic

### ⚠️ Edge Cases:

1. **Fixture not in processed_fixtures**: 
   - If a fixture was never properly added to stats, revert will log a warning and skip

2. **Multiple seasons**:
   - Always use the correct `season_id` from the fixture

3. **Partial matchups**:
   - Only matchups with non-null goals will be processed

4. **Category changes**:
   - When points are reverted, a player's category might change (e.g., from Legend back to Classic)

---

## Testing

Test fixture deletion with these steps:

1. Create a fixture with results
2. Note player points and star ratings BEFORE deletion
3. Delete the fixture using the proper workflow
4. Verify player stats are correctly reverted
5. Check that categories were recalculated

Expected result: Player should return to the exact same points/stars/category they had before the fixture was played.
