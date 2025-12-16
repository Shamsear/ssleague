# Fantasy Scoring Rules - Strict Database Mode ✅

## Changes Made

The `recalculate-fantasy-points-simple.js` script now **STRICTLY** uses scoring rules from the database with **NO DEFAULT FALLBACKS**.

### Before (Had Defaults)
```javascript
// ❌ Used fallback defaults (|| 0)
const homeBasePoints = 
  (matchup.home_goals || 0) * (SCORING_RULES.goals_scored || 0) +
  (homeCleanSheet ? (SCORING_RULES.clean_sheet || 0) : 0) +
  // ... more fallbacks
```

### After (Strict Database Only)
```javascript
// ✅ Uses ONLY database values, no fallbacks
const homeBasePoints = 
  (matchup.home_goals || 0) * SCORING_RULES.goals_scored +
  (homeCleanSheet ? SCORING_RULES.clean_sheet : 0) +
  // ... no fallbacks, will error if rule missing
```

## Validation Added

The script now validates that all required rules exist in the database:

### Required Rules (Script will FAIL if missing):
- `goals_scored` - Points per goal
- `win` - Points for winning
- `draw` - Points for drawing
- `match_played` - Points for appearance
- `clean_sheet` - Points for clean sheet
- `motm` - Points for Man of the Match

### Optional Rules (Used if present):
- `hat_trick` - Bonus for 3+ goals
- `concedes_4_plus_goals` - Penalty for conceding 4+ goals
- `substitution_penalty` - Penalty for substitutions

## Error Handling

If scoring rules are missing from the database:
```
❌ No active scoring rules found in database!
❌ Missing required scoring rules: goals_scored, win, draw
```

The script will **FAIL IMMEDIATELY** and not use any default values.

## Testing

Run the validation test:
```bash
node test-scoring-rules-validation.js
```

This will check if all required rules are present in the database.

## Current Database Rules

From `fantasy_scoring_rules` table:
- **goals_scored**: 2 points
- **win**: 3 points
- **draw**: 1 point
- **match_played**: 1 point
- **clean_sheet**: 6 points
- **motm**: 5 points
- **hat_trick**: 5 points
- **concedes_4_plus_goals**: -3 points
- **substitution_penalty**: -2 points

## Usage

```bash
# Recalculate all fantasy points using database rules
node scripts/recalculate-fantasy-points-simple.js

# Validate rules before running
node test-scoring-rules-validation.js
```

## Key Points

✅ **NO DEFAULT VALUES** - Script uses only database rules
✅ **VALIDATION** - Checks for required rules before processing
✅ **FAIL FAST** - Errors immediately if rules are missing
✅ **TRANSPARENT** - Shows all loaded rules at startup
✅ **FLEXIBLE** - Optional rules are used only if present

The script is now 100% dependent on the database configuration!
