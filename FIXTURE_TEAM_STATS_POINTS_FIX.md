# Fixture Team Stats & Standings - Points Fix

## Issue
When fixture results were saved for win-based tournaments (Champions League, Pro League), the system was storing the sum of goals as the team scores in the `fixtures` table. This caused the tournament standings to show incorrect results because:

1. `home_score` and `away_score` in fixtures table stored goal totals instead of points
2. The standings calculation reads these stored scores to determine wins/draws/losses
3. Teams with more total goals but fewer matchup wins would incorrectly rank higher

**Example:**
```
Matchups:
- Team A: 3 wins (1-0, 1-0, 4-1) = 6 total goals, 9 points
- Team B: 2 wins (0-3, 0-4) = 7 total goals, 6 points

Bug: Standings showed Team B ahead (7 > 6 goals)
Correct: Team A should be ahead (9 > 6 points)
```

## Root Cause
In `app/api/fixtures/[fixtureId]/matchups/route.ts`, the PATCH endpoint (which saves matchup results) was calculating fixture scores by summing goals regardless of tournament type:

```typescript
// OLD CODE - Always summed goals
for (const result of results) {
  totalHomeScore += result.home_goals;
  totalAwayScore += result.away_goals;
}
```

## Solution

### Updated Score Calculation (`app/api/fixtures/[fixtureId]/matchups/route.ts`)

**Added tournament scoring type check:**

```typescript
// Get tournament scoring type
const tournamentInfo = await sql`
  SELECT t.id as tournament_id, ts.scoring_type
  FROM fixtures f
  JOIN tournaments t ON f.tournament_id = t.id
  LEFT JOIN tournament_settings ts ON t.id = ts.tournament_id
  WHERE f.id = ${fixtureId}
  LIMIT 1
`;

const scoringType = tournamentInfo[0]?.scoring_type || 'goals';

let totalHomeScore = 0;
let totalAwayScore = 0;

if (scoringType === 'wins') {
  // Win-based scoring: 3 points for win, 1 for draw, 0 for loss
  for (const result of results) {
    if (result.home_goals > result.away_goals) {
      totalHomeScore += 3; // Home wins
    } else if (result.away_goals > result.home_goals) {
      totalAwayScore += 3; // Away wins
    } else {
      totalHomeScore += 1; // Draw
      totalAwayScore += 1; // Draw
    }
  }
} else {
  // Goal-based scoring: sum of all goals
  for (const result of results) {
    totalHomeScore += result.home_goals;
    totalAwayScore += result.away_goals;
  }
}
```

## How It Works

### Data Flow

1. **Matchup Results Entered** → User enters goals for each matchup (e.g., 1-0, 0-3, 4-1)
2. **Score Calculation** → System checks tournament `scoring_type`:
   - If `'wins'`: Count wins (3 pts), draws (1 pt), losses (0 pts)
   - If `'goals'`: Sum all goals
3. **Fixture Update** → Saves calculated scores to `fixtures.home_score` and `fixtures.away_score`
4. **Standings Calculation** → Reads fixture scores to build tournament standings

### For Win-Based Tournaments

**Matchups:**
```
1. Player A 1-0 Player B → Home wins → +3 points
2. Player C 0-3 Player D → Away wins → +3 points
3. Player E 1-1 Player F → Draw → +1 point each
4. Player G 2-0 Player H → Home wins → +3 points
5. Player I 0-2 Player J → Away wins → +3 points
```

**Fixture Scores Saved:**
- `home_score`: 7 points (3+1+3 = 7)
- `away_score`: 7 points (3+1+3 = 7)
- `result`: 'draw'

**Standings Display:**
```
Team A: 7 points (2W-1D-2L)
Team B: 7 points (2W-1D-2L)
```

### For Goal-Based Tournaments

**Matchups:**
```
1. Player A 2-1 Player B
2. Player C 1-0 Player D
3. Player E 3-2 Player F
```

**Fixture Scores Saved:**
- `home_score`: 6 goals (2+1+3 = 6)
- `away_score`: 3 goals (1+0+2 = 3)
- `result`: 'home_win'

**Standings Display:**
```
Team A: 6 GF, 3 GA, +3 GD
Team B: 3 GF, 6 GA, -3 GD
```

## Impact on Standings

The standings API (`app/api/tournaments/[id]/standings/route.ts`) reads `home_score` and `away_score` from fixtures and uses them to calculate:
- **Wins/Draws/Losses**: By comparing scores
- **Goals For/Against**: Using the score values
- **Points**: 3 for win, 1 for draw, 0 for loss

With this fix, win-based tournaments will have correct point values stored, so standings will rank teams properly.

## Testing

1. **Create/Enter Results** for a Champions League fixture with mixed results
2. **Verify Fixture Scores**:
   ```sql
   SELECT home_score, away_score, result 
   FROM fixtures 
   WHERE id = 'fixture_id';
   ```
   Should show points (multiples of 3 or 1), not goal sums

3. **Check Standings**: Navigate to tournament standings
   - Teams should be ranked by points from matchup wins
   - Goals For/Against columns show points, not goals
   - Correct winner determination

4. **Compare Tournaments**:
   - League (goals): Shows actual goal totals
   - Champions League (wins): Shows point totals

## Files Modified
- `app/api/fixtures/[fixtureId]/matchups/route.ts`

## Related Fixes
This completes the full points system implementation:
1. ✅ Current Score display (live during entry)
2. ✅ Match Result display (after save)
3. ✅ WhatsApp share message
4. ✅ **Fixture score storage** (this fix)
5. ✅ **Tournament standings** (automatically fixed by correct storage)

## Benefits
- **Accurate standings**: Teams ranked by matchup wins, not goal totals
- **Consistent data**: Stored scores match the tournament format
- **Correct winner determination**: Based on points for win-based tournaments
- **Future-proof**: Any feature reading fixture scores will get correct values
