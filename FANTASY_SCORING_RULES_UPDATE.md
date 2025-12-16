# Fantasy Scoring Rules - Database Integration ✅

## Problem
The `recalculate-fantasy-points-simple.js` script was using hardcoded scoring rules instead of fetching them from the database.

## Solution
Updated the script to dynamically fetch scoring rules from the `fantasy_scoring_rules` table in the fantasy database.

## Changes Made

### 1. Fetch Scoring Rules from Database
```javascript
// OLD - Hardcoded rules
const SCORING_RULES = {
  goal: 5,
  clean_sheet: 4,
  motm: 3,
  win: 2,
  draw: 1,
  appearance: 1,
};

// NEW - Fetched from database
const scoringRulesData = await fantasyDb`
  SELECT rule_type, rule_name, points_value, applies_to
  FROM fantasy_scoring_rules
  WHERE is_active = true
`;
```

### 2. Updated Point Calculation
Now includes all rules from the database:
- **goals_scored**: 2 points per goal
- **clean_sheet**: 6 points (0 goals conceded)
- **motm**: 5 points (Man of the Match)
- **win**: 3 points
- **draw**: 1 point
- **match_played**: 1 point (appearance)
- **hat_trick**: 5 points (3+ goals)
- **concedes_4_plus_goals**: -3 points (4+ goals conceded)
- **substitution_penalty**: -2 points

### 3. Captain/Vice-Captain Multipliers
- Captain (C): 2x points
- Vice-Captain (VC): 1.5x points
- Regular player: 1x points

## Database Table Structure

**fantasy_scoring_rules** table:
- `rule_type`: Type of scoring rule (e.g., 'goals_scored', 'win')
- `rule_name`: Display name
- `points_value`: Points awarded (can be negative)
- `applies_to`: 'player' or 'team'
- `is_active`: Whether the rule is currently active

## Usage

Run the script to recalculate all fantasy points:
```bash
node scripts/recalculate-fantasy-points-simple.js
```

The script will:
1. Fetch active scoring rules from the database
2. Calculate points for all completed matchups
3. Apply captain/VC multipliers
4. Update the `fantasy_squad` table with new point totals

## Test Results
✅ Successfully updated 41 player-team combinations
✅ Total points calculated: 653 (with multipliers)
✅ Average points per entry: 15.93

## Files Changed
- `scripts/recalculate-fantasy-points-simple.js` - Updated to use database scoring rules
