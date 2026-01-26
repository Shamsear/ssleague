# Win-Based Tournament Substitution Penalty Fix

## Problem
In win-based tournaments, substitution penalties were being incorrectly handled:
- Substitution goals were added to the total fixture score separately
- This caused player stats to include substitution penalty goals
- The logic didn't match the intended behavior

## Intended Behavior

### Win-Based Tournaments
When a substitution is made:
1. **Substitution penalty is added to the specific matchup score** (to determine matchup winner)
2. **Matchup winner determines points** (3 for win, 1 for draw, 0 for loss)
3. **Player stats do NOT include substitution penalty goals**

### Example
- Player A vs Player B
- Original result: Player A scores 2, Player B scores 3
- Player A is substituted with Player C (2 goal penalty)
- **Matchup result: (2+2) vs 3 = 4-3** (Player C's side wins)
- **Player C's stats: 2 goals** (not 4)
- **Matchup points: Home gets 3 points** (for winning the matchup)

### Goal-Based Tournaments
- Substitution penalties ARE added to player stats
- Total goals determine the winner
- Current behavior remains unchanged

## Changes Made

### 1. `app/api/fixtures/[fixtureId]/matchups/route.ts` (PATCH endpoint)

**Before:**
```typescript
// Calculated total score first, then added all penalties at the end
totalHomeScore += awaySubPenalty + home_penalty_goals;
totalAwayScore += homeSubPenalty + away_penalty_goals;
```

**After:**
```typescript
if (scoringType === 'wins') {
  // For each matchup, add sub penalties to determine matchup winner
  for (const result of results) {
    const penalties = penaltiesMap.get(result.position);
    const homeMatchupScore = result.home_goals + penalties.away_sub_penalty;
    const awayMatchupScore = result.away_goals + penalties.home_sub_penalty;
    
    // Award points based on matchup result
    if (homeMatchupScore > awayMatchupScore) {
      totalHomeScore += 3; // Home wins matchup
    } else if (awayMatchupScore > homeMatchupScore) {
      totalAwayScore += 3; // Away wins matchup
    } else {
      totalHomeScore += 1; // Draw
      totalAwayScore += 1;
    }
  }
  
  // Only fine/violation penalties are added to total
  totalHomeScore += home_penalty_goals;
  totalAwayScore += away_penalty_goals;
}
```

### 2. `app/api/teamstats/update-stats/route.ts`

**Before:**
```typescript
// Used provided scores which included sub penalties
let homeTeamGoals = home_score !== undefined ? home_score : 0;
```

**After:**
```typescript
// Calculate goals WITHOUT substitution penalties
let homeTeamGoals = 0;
let awayTeamGoals = 0;

if (matchups && Array.isArray(matchups)) {
  for (const matchup of matchups) {
    homeTeamGoals += matchup.home_goals; // Only actual goals
    awayTeamGoals += matchup.away_goals;
  }
}

// Add fine/violation penalties (these DO count as goals)
homeTeamGoals += home_penalty_goals;
awayTeamGoals += away_penalty_goals;

// For win-based, use provided scores to determine winner
// But goals_for/goals_against don't include sub penalties
if (tournamentScoringType === 'wins') {
  homeWon = home_score > away_score; // Uses points
  // But team stats use homeTeamGoals (without sub penalties)
}
```

## Database Schema

The `matchups` table already has the correct fields:
- `home_sub_penalty` - Penalty goals awarded to away team
- `away_sub_penalty` - Penalty goals awarded to home team
- `home_goals` - Actual goals scored (without penalties)
- `away_goals` - Actual goals scored (without penalties)

## Testing

To verify the fix:

1. **Create a win-based tournament fixture**
2. **Submit lineups with a substitution**
3. **Enter results:**
   - Original player would have scored 2
   - Substitute scores 2
   - Opponent scores 3
4. **Verify:**
   - Matchup shows 4-3 (2 actual + 2 penalty)
   - Substitute's stats show 2 goals (not 4)
   - Team gets 3 points for winning the matchup
   - Team stats show 2 goals_for (not 4)

## Impact

- ✅ Win-based tournaments now correctly handle substitution penalties
- ✅ Player stats are accurate (no inflated goals from penalties)
- ✅ Match results are correct (penalties affect winner determination)
- ✅ Goal-based tournaments unchanged (backward compatible)
- ✅ Fine/violation penalties still work correctly

## Related Files
- `app/api/fixtures/[fixtureId]/matchups/route.ts` - Result entry logic
- `app/api/teamstats/update-stats/route.ts` - Team stats calculation
- `migrations/add_substitution_fields_to_matchups.sql` - Database schema
