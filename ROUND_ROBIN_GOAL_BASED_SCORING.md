# Round Robin Goal-Based Scoring Update

## Overview
Updated the Round Robin knockout format to properly handle goal-based scoring by considering both total goals AND matchup wins.

## Problem
Previously, Round Robin format only counted wins regardless of the scoring system. For goal-based tournaments, this didn't make sense - teams should be judged by goals scored, not just matchup wins.

## Solution

### Scoring Logic by Format and Type

#### 1. Round Robin + Goal-Based Scoring (NEW)
- **Primary Metric**: Total goals scored across all 25 matchups
- **Tiebreaker**: Number of matchups won
- **Winner Determination**: 
  1. Team with more total goals wins
  2. If goals are tied, team with more matchup wins wins
  3. If both are tied, it's a draw

**Example:**
```
Home Team: 45 goals (12 matchup wins)
Away Team: 45 goals (13 matchup wins)
Result: Away Team wins (same goals, but more matchup wins)
```

#### 2. Round Robin + Win-Based Scoring
- **Metric**: Matchup wins (3 points per win, 1 per draw)
- **Winner**: Team with more total points
- No change from previous implementation

#### 3. Standard Goal-Based Scoring (Single Leg / Two Leg)
- **Metric**: Total goals scored
- **Winner**: Team with more goals
- No change from previous implementation

#### 4. Standard Win-Based Scoring
- **Metric**: Matchup wins
- **Winner**: Team with more matchup wins
- No change from previous implementation

## Implementation Details

### Code Changes

**File**: `app/api/fixtures/[fixtureId]/matchups/route.ts`

Added detection for Round Robin + Goal-Based combination:

```typescript
// For round_robin with goal-based scoring, use hybrid approach
if (knockoutFormat === 'round_robin' && scoringType === 'goals') {
  // Count total goals (primary)
  // Count matchup wins (tiebreaker)
  
  // Winner determined by:
  // 1. Total goals
  // 2. If tied, matchup wins
}
```

### Database Fields Used
- `fixtures.knockout_format`: 'single_leg' | 'two_leg' | 'round_robin'
- `tournament_settings.scoring_type`: 'goals' | 'wins'
- `matchups.home_goals`, `matchups.away_goals`: Individual matchup scores
- `matchups.home_sub_penalty`, `matchups.away_sub_penalty`: Substitution penalties

### Substitution Penalties
- In goal-based scoring: Added to total goals
- In win-based scoring: Used to determine matchup winner
- Applied consistently across all formats

### Fine/Violation Penalties
- `fixtures.home_penalty_goals`, `fixtures.away_penalty_goals`
- Always added to final score regardless of format
- Used for disciplinary actions (late submissions, rule violations)

## UI Updates

**File**: `app/dashboard/committee/team-management/tournament/page.tsx`

Updated the Round Robin description to be dynamic:
- Goal-based: "Winner determined by total goals scored (with matchup wins as tiebreaker)"
- Win-based: "Winner determined by total matchup wins"

## Use Cases

### Scenario 1: Clear Goal Winner
```
Format: Round Robin
Scoring: Goals

Home: 50 goals (10 wins)
Away: 45 goals (15 wins)

Result: Home wins (more goals)
```

### Scenario 2: Tied Goals, Different Wins
```
Format: Round Robin
Scoring: Goals

Home: 48 goals (12 wins)
Away: 48 goals (10 wins)

Result: Home wins (same goals, more wins)
```

### Scenario 3: Complete Tie
```
Format: Round Robin
Scoring: Goals

Home: 48 goals (12 wins)
Away: 48 goals (12 wins)

Result: Draw
```

### Scenario 4: Win-Based (No Change)
```
Format: Round Robin
Scoring: Wins

Home: 45 goals (12 wins = 36 points)
Away: 50 goals (10 wins = 30 points)

Result: Home wins (more matchup wins)
```

## Benefits

1. **Logical Consistency**: Goal-based tournaments now properly count goals
2. **Fair Tiebreaker**: Matchup wins serve as a meaningful tiebreaker
3. **Flexibility**: Supports both goal-based and win-based approaches
4. **Backward Compatible**: Existing win-based tournaments work unchanged

## Testing Recommendations

1. Create a Round Robin fixture with goal-based scoring
2. Enter results where:
   - Team A has more goals but fewer wins
   - Team B has fewer goals but more wins
3. Verify Team A wins (goals take priority)
4. Test tied goals scenario to verify win tiebreaker works
5. Verify win-based scoring still works as before

## Notes

- This change only affects Round Robin format with goal-based scoring
- All other formats (single leg, two leg) remain unchanged
- Win-based scoring behavior is unchanged
- Substitution and fine penalties are properly included in calculations
