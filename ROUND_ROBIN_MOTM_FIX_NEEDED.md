# Round Robin MOTM Display Fix

## Problem
In round robin format (5v5 = 25 matchups), when selecting Man of the Match, each player appears 5 times in the dropdown/list instead of appearing once with combined stats.

**Example:**
- Player A appears 5 times (once for each matchup against opponents)
- Should appear once with combined goals from all 5 matchups

## Root Cause
The MOTM player list is built directly from the matchups array without aggregating players who appear multiple times.

## Solution

### Step 1: Detect Round Robin Format
Check if `fixture.knockout_format === 'round_robin'`

### Step 2: Aggregate Player Stats
For round robin, aggregate players by player_id:

```typescript
// For round robin, aggregate players
const aggregatedPlayers = new Map();

matchups.forEach(matchup => {
  // Aggregate home player
  if (!aggregatedPlayers.has(matchup.home_player_id)) {
    aggregatedPlayers.set(matchup.home_player_id, {
      player_id: matchup.home_player_id,
      player_name: matchup.home_player_name,
      total_goals: 0,
      matchups_played: 0
    });
  }
  const homePlayer = aggregatedPlayers.get(matchup.home_player_id);
  homePlayer.total_goals += (matchup.home_goals || 0);
  homePlayer.matchups_played += 1;
  
  // Aggregate away player
  if (!aggregatedPlayers.has(matchup.away_player_id)) {
    aggregatedPlayers.set(matchup.away_player_id, {
      player_id: matchup.away_player_id,
      player_name: matchup.away_player_name,
      total_goals: 0,
      matchups_played: 0
    });
  }
  const awayPlayer = aggregatedPlayers.get(matchup.away_player_id);
  awayPlayer.total_goals += (matchup.away_goals || 0);
  awayPlayer.matchups_played += 1;
});

// Convert to array and sort by goals
const playerList = Array.from(aggregatedPlayers.values())
  .sort((a, b) => b.total_goals - a.total_goals);
```

### Step 3: Display Aggregated Stats
Show each player once with their combined stats:

```tsx
{playerList.map(player => (
  <option key={player.player_id} value={player.player_id}>
    {player.player_name} - {player.total_goals} goals ({player.matchups_played} matchups)
  </option>
))}
```

## Files to Modify

### 1. Team Fixture Page
**File:** `app/dashboard/team/fixture/[fixtureId]/page.tsx`

**Location:** Where MOTM player dropdown/list is rendered

**Changes:**
- Add logic to detect round robin format
- Aggregate players when format is round_robin
- Display aggregated stats in dropdown

### 2. Committee Fixture Page (if applicable)
**File:** `app/dashboard/committee/team-management/fixture/[fixtureId]/page.tsx`

**Same changes as above**

## Example Output

### Before (Wrong):
```
Select Man of the Match:
- Ronaldo (2 goals)
- Ronaldo (1 goal)
- Ronaldo (3 goals)
- Ronaldo (0 goals)
- Ronaldo (2 goals)
- Messi (1 goal)
- Messi (2 goals)
...
```

### After (Correct):
```
Select Man of the Match:
- Ronaldo - 8 goals (5 matchups)
- Messi - 7 goals (5 matchups)
- Neymar - 6 goals (5 matchups)
- Benzema - 5 goals (5 matchups)
- Vinicius - 4 goals (5 matchups)
```

## Benefits
1. Cleaner UI - each player appears once
2. Better decision making - see total performance
3. Accurate representation of round robin format
4. Easier to identify top performer

## Testing
1. Create a round robin fixture
2. Generate 25 matchups
3. Enter results for all matchups
4. Open MOTM selection
5. Verify each player appears only once with combined stats
