# Penalty Goals Fix - Now Included in Team Stats

## Problem
Penalty/fine goals were being tracked in the fixture edit page but were NOT being included in:
- Fixture total scores (`home_score`, `away_score`)
- Team statistics (goals for, goals against)
- Tournament standings
- Match results (win/loss/draw determination)

## Root Cause
In `app/api/fixtures/[fixtureId]/matchups/route.ts`, when saving matchup results, the total scores were calculated from matchup goals only:

```typescript
// OLD CODE - Missing penalty goals
let totalHomeScore = 0;
let totalAwayScore = 0;
for (const result of results) {
  totalHomeScore += result.home_goals;
  totalAwayScore += result.away_goals;
}
// Penalty goals were NOT added here!
```

## Solution
Updated the matchups API to:
1. Fetch penalty goals from the fixture
2. Add them to the total scores before updating the fixture

### Changes Made

**File:** `app/api/fixtures/[fixtureId]/matchups/route.ts`

#### 1. Fetch Penalty Goals
```typescript
// Fetch fixture with penalty goals
const fixtures = await sql`
  SELECT f.season_id, f.round_number, f.leg, 
         COALESCE(f.home_penalty_goals, 0) as home_penalty_goals,
         COALESCE(f.away_penalty_goals, 0) as away_penalty_goals
  FROM fixtures f
  WHERE f.id = ${fixtureId}
  LIMIT 1
`;

const { season_id, round_number, leg, home_penalty_goals, away_penalty_goals } = fixtures[0];
```

#### 2. Include Penalty Goals in Total Score
```typescript
// Calculate total scores from all matchups
let totalHomeScore = 0;
let totalAwayScore = 0;
for (const result of results) {
  totalHomeScore += result.home_goals;
  totalAwayScore += result.away_goals;
}

// Add penalty/fine goals to total scores
totalHomeScore += Number(home_penalty_goals) || 0;
totalAwayScore += Number(away_penalty_goals) || 0;

console.log(`Total scores including penalties - Home: ${totalHomeScore}, Away: ${totalAwayScore}`);
```

## How It Works Now

### Workflow
1. **Committee edits match** and sets penalty goals (e.g., Home: 2, Away: 1)
2. **Matchups are saved** with player goals
3. **Total score calculated:**
   - Home: Player goals (5) + Penalty goals (2) = **7 total**
   - Away: Player goals (3) + Penalty goals (1) = **4 total**
4. **Fixture updated** with `home_score = 7`, `away_score = 4`
5. **Standings automatically updated** because they use `home_score` and `away_score`

### Data Flow
```
Penalty Goals (fixtures table)
    ↓
Matchups API (when saving results)
    ↓
Total Score Calculation
    ↓
Fixture Scores (home_score, away_score)
    ↓
Tournament Standings API
    ↓
Team Stats (goals_for, goals_against, points)
```

## Where Penalty Goals Are Now Reflected

✅ **Fixture View Page** (`app/fixtures/[id]/page.tsx`)
- Shows penalty goals breakdown
- Included in total score display

✅ **Team Fixture Page** (`app/dashboard/team/fixture/[fixtureId]/page.tsx`)
- Shows penalty goals in score breakdown
- Included in WhatsApp share message
- Displayed in score summary

✅ **Fixture Scores** (fixtures table)
- `home_score` and `away_score` include penalty goals

✅ **Tournament Standings** (`app/api/tournaments/[id]/standings/route.ts`)
- Uses `home_score` and `away_score` from fixtures
- Automatically includes penalty goals in:
  - Goals For
  - Goals Against
  - Goal Difference
  - Win/Loss/Draw determination
  - Points calculation

✅ **Team Statistics**
- All stats derived from fixture scores
- Penalty goals automatically counted

## Example

### Scenario
- **Match:** Team A vs Team B
- **Player Goals:** A: 5, B: 3
- **Penalty Goals:** A: 2 (fines), B: 1 (violation)

### Before Fix
```
Fixture Score: A: 5 - B: 3
Team A Stats: +5 goals for, +3 goals against
Team B Stats: +3 goals for, +5 goals against
Result: Team A wins
```
❌ Penalty goals missing from stats!

### After Fix
```
Fixture Score: A: 7 - B: 4
Team A Stats: +7 goals for, +4 goals against
Team B Stats: +4 goals for, +7 goals against
Result: Team A wins
```
✅ Penalty goals included in all stats!

## Testing Checklist

- [ ] Edit a match and set penalty goals (e.g., Home: 2, Away: 1)
- [ ] Save matchup results
- [ ] Check fixture page shows correct total score
- [ ] Check tournament standings show correct goals for/against
- [ ] Verify team stats include penalty goals
- [ ] Check win/loss/draw is determined correctly with penalties
- [ ] Verify goal difference includes penalty goals
- [ ] Check WhatsApp share message shows penalty goals

## Notes

- Penalty goals are stored in `fixtures` table: `home_penalty_goals`, `away_penalty_goals`
- They are set via the fixture edit page (MOTM & Penalties section)
- They are now automatically included when matchups are saved
- No changes needed to standings calculation - it uses fixture scores
- Backward compatible - existing fixtures without penalty goals work fine (defaults to 0)

## Related Files

- `app/api/fixtures/[fixtureId]/matchups/route.ts` - **UPDATED** (includes penalty goals)
- `app/api/fixtures/[fixtureId]/route.ts` - Saves penalty goals to fixture
- `app/api/tournaments/[id]/standings/route.ts` - Uses fixture scores (no change needed)
- `app/fixtures/[id]/page.tsx` - Displays penalty goals
- `app/dashboard/team/fixture/[fixtureId]/page.tsx` - Shows penalty goals in UI
