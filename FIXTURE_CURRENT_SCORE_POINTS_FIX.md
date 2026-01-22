# Fixture Current Score - Points Display Fix

## Issue
The "Current Score" display on the fixture page was showing goals instead of points for win-based tournaments (Champions League, Pro League). It should calculate points based on matchup wins/draws/losses:
- **Win**: 3 points
- **Draw**: 1 point
- **Loss**: 0 points

Additionally, the score wasn't updating in real-time as users entered matchup results.

## Root Cause
1. The Current Score calculation was hardcoded to sum goals regardless of tournament system
2. The calculation was using `matchups` array (saved data) instead of `matchResults` state (live input)
3. No logic to count wins/draws/losses for point calculation

## Changes Made

### 1. Updated Score Calculation Logic (`app/dashboard/team/fixture/[fixtureId]/page.tsx`)

**Added conditional scoring based on tournament system:**

```typescript
if (tournamentSystem === 'wins') {
  // Win-based scoring: 3 points for win, 1 for draw, 0 for loss
  let homePoints = 0;
  let awayPoints = 0;
  
  // Use matchResults state for live updates
  Object.entries(matchResults).forEach(([position, result]: [string, any]) => {
    const homeGoals = result?.home_goals ?? 0;
    const awayGoals = result?.away_goals ?? 0;
    
    if (homeGoals > awayGoals) {
      homePoints += 3; // Home wins
    } else if (awayGoals > homeGoals) {
      awayPoints += 3; // Away wins
    } else if (homeGoals === awayGoals && homeGoals > 0) {
      homePoints += 1; // Draw (only if both scored)
      awayPoints += 1; // Draw
    }
  });
  
  // Add penalties
  homeTotalScore = homePoints + awaySubPenalties + homePenaltyGoals;
  awayTotalScore = awayPoints + homeSubPenalties + awayPenaltyGoals;
} else {
  // Goal-based scoring: sum of all goals
  homeTotalScore = homePlayerGoals + awaySubPenalties + homePenaltyGoals;
  awayTotalScore = awayPlayerGoals + homeSubPenalties + awayPenaltyGoals;
}
```

### 2. Updated W-D-L Display

**Changed from using `matchups` to `matchResults` for live updates:**

```typescript
// Home team W-D-L
{Object.values(matchResults).filter((m: any) => (m?.home_goals ?? 0) > (m?.away_goals ?? 0)).length}W-
{Object.values(matchResults).filter((m: any) => (m?.home_goals ?? 0) === (m?.away_goals ?? 0) && (m?.home_goals ?? 0) > 0).length}D-
{Object.values(matchResults).filter((m: any) => (m?.home_goals ?? 0) < (m?.away_goals ?? 0)).length}L

// Away team W-D-L
{Object.values(matchResults).filter((m: any) => (m?.away_goals ?? 0) > (m?.home_goals ?? 0)).length}W-
{Object.values(matchResults).filter((m: any) => (m?.home_goals ?? 0) === (m?.away_goals ?? 0) && (m?.away_goals ?? 0) > 0).length}D-
{Object.values(matchResults).filter((m: any) => (m?.away_goals ?? 0) < (m?.home_goals ?? 0)).length}L
```

### 3. Updated Display Label

**Added "(Points)" indicator for win-based tournaments:**

```typescript
<div className="text-center text-xs font-semibold text-gray-600 mb-2">
  Current Score {tournamentSystem === 'wins' && '(Points)'}
</div>
```

### 4. Conditional Footer Text

**Only show "s = sub penalty, f = fine" for goal-based tournaments:**

```typescript
{tournamentSystem === 'goals' && (
  <div className="text-center mt-2 text-xs text-gray-500">
    s = sub penalty, f = fine
  </div>
)}
```

## How It Works Now

### For Goals-Based Tournaments (League)
```
Current Score
Los Galacticos    -    La Masia FC
      6                    8
   (6 +0s +0f)         (8 +0s +0f)

s = sub penalty, f = fine
```

### For Wins-Based Tournaments (Champions League, Pro League)
```
Current Score (Points)
Los Galacticos    -    La Masia FC
      9                    6
     3W-0D-2L             2W-0D-3L
```

**Point Calculation Example:**
- Los Galacticos: 3 wins × 3 points = 9 points
- La Masia FC: 2 wins × 3 points = 6 points

## Real-Time Updates

The score now updates **live** as you enter matchup results because it uses the `matchResults` state object instead of the saved `matchups` array. Every time you change a goal value in the input fields, the Current Score recalculates immediately.

## Testing

1. Navigate to a Champions League or Pro League fixture
2. Enter result entry mode
3. Enter goals for matchups (e.g., 2-1, 1-1, 0-2, 3-0, 1-0)
4. Watch the Current Score update in real-time showing:
   - Total points (not goals)
   - W-D-L record below each team
   - "(Points)" label in the header
5. Verify the calculation:
   - 2-1 (home win) = 3 points for home
   - 1-1 (draw) = 1 point each
   - 0-2 (away win) = 3 points for away
   - etc.

## Files Modified
- `app/dashboard/team/fixture/[fixtureId]/page.tsx`

## Benefits
- **Accurate scoring**: Shows points for win-based tournaments, goals for goal-based
- **Real-time updates**: Score updates as you type, no need to save first
- **Clear display**: W-D-L record shows matchup results at a glance
- **Professional**: Matches the tournament format correctly
