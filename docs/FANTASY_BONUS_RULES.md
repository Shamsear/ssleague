# Fantasy Bonus/Conditional Scoring Rules

## Overview

The bonus rules system allows you to create conditional scoring rules that apply extra points based on specific circumstances, such as:
- New player bonuses
- Scoring streaks
- Milestone achievements
- Position-specific bonuses
- Time-based bonuses
- Special match bonuses

## Setup

### 1. Run the Migration

```bash
python scripts/run-bonus-migration.py
```

This adds three new columns to the `scoring_rules` table:
- `is_bonus_rule` (BOOLEAN) - Whether this is a bonus rule
- `bonus_conditions` (JSONB) - The conditions for the bonus
- `priority` (INTEGER) - Rule priority for stacking

## Bonus Rule Types

### 1. New Player Bonus 🆕

Give extra points to newly acquired players in their first few matches.

**Example**: "+2 points for any goal scored by a new player in their first match"

**Configuration**:
```json
{
  "condition_type": "new_player",
  "matches_count": 1,
  "since_gameweek": 5
}
```

**Fields**:
- `matches_count`: Number of first matches to apply bonus
- `since_gameweek`: (optional) Only apply to players acquired after this gameweek

---

### 2. Streak Bonus 🔥

Reward players who achieve consecutive results.

**Example**: "+5 bonus points when a player scores in 3 consecutive matches"

**Configuration**:
```json
{
  "condition_type": "streak",
  "event_type": "goal",
  "consecutive_matches": 3
}
```

**Fields**:
- `event_type`: Type of event (goal, assist, clean_sheet)
- `consecutive_matches`: Number of consecutive matches required

---

### 3. Milestone Bonus 🎯

One-time bonus when reaching specific milestones.

**Example**: "+10 points when a player reaches 10 goals in the season"

**Configuration**:
```json
{
  "condition_type": "milestone",
  "event_type": "goal",
  "count": 10,
  "scope": "season"
}
```

**Fields**:
- `event_type`: Type of event to count
- `count`: Number required for milestone
- `scope`: "season" or "tournament"

---

### 4. Position-Specific Bonus ⚽

Extra points for specific positions doing certain actions.

**Example**: "Defenders get +3 extra points for scoring a goal"

**Configuration**:
```json
{
  "condition_type": "position",
  "positions": ["GK", "CB", "LB", "RB"],
  "event_type": "goal"
}
```

**Fields**:
- `positions`: Array of position codes
- `event_type`: The event that triggers the bonus

---

### 5. Time-Based Bonus ⏰

Bonuses for events during specific time periods.

**Example**: "Goals in the final 10 minutes get double points"

**Configuration**:
```json
{
  "condition_type": "time_period",
  "minutes": {"min": 80, "max": 90}
}
```

**Fields**:
- `minutes.min`: Start minute
- `minutes.max`: End minute

---

### 6. Match Type Bonus 🏆

Special bonuses for specific match types.

**Example**: "Derby match goals worth +5 extra points"

**Configuration**:
```json
{
  "condition_type": "match_type",
  "types": ["derby", "final", "semi-final"]
}
```

**Fields**:
- `types`: Array of special match types

---

## Creating Bonus Rules via UI

1. Navigate to: `/dashboard/committee/fantasy/scoring/[leagueId]`
2. Click "Create New Rule"
3. Fill in basic rule details (name, type, points)
4. Check "🎁 This is a Bonus/Conditional Rule"
5. Select the bonus condition type
6. Configure the specific parameters
7. Click "Create Rule"

## Example Use Cases

### 1. Welcome Bonus for New Signings
```
Rule Name: New Player Welcome Bonus
Rule Type: goal
Points Value: +2
Is Bonus Rule: ✓
Condition: New Player (First 1 match)
```
**Result**: New players get +2 extra points for goals in their debut

### 2. Hat-trick Streak Bonus
```
Rule Name: On Fire Streak
Rule Type: goal
Points Value: +5
Is Bonus Rule: ✓
Condition: Streak (3 consecutive matches with goals)
```
**Result**: +5 bonus when player scores in 3 matches in a row

### 3. Golden Boot Milestone
```
Rule Name: 10-Goal Milestone
Rule Type: goal
Points Value: +10
Is Bonus Rule: ✓
Condition: Milestone (10 goals in season)
```
**Result**: +10 bonus when player reaches 10th goal

### 4. Defender Goal Bonus
```
Rule Name: Defender Scoring Bonus
Rule Type: goal
Points Value: +3
Is Bonus Rule: ✓
Condition: Position (CB, LB, RB)
```
**Result**: Defenders get +3 extra points for any goal

## How Bonuses are Applied

When calculating fantasy points:

1. **Base rules** are applied first (e.g., normal goal = 10 pts)
2. **Bonus rules** are checked in priority order
3. Multiple bonuses can stack (unless specified otherwise)
4. Final score = Base Points + All Applicable Bonuses

**Example**:
- Player: Defender who scores in 80th minute in their debut
- Base goal points: 10
- Position bonus (defender): +3
- New player bonus: +2
- Late goal bonus: +2
- **Total**: 17 points!

## Database Schema

```sql
CREATE TABLE scoring_rules (
  rule_id SERIAL PRIMARY KEY,
  league_id VARCHAR(100),
  rule_name VARCHAR(255),
  rule_type VARCHAR(100),
  points_value DECIMAL(10, 2),
  is_bonus_rule BOOLEAN DEFAULT false,
  bonus_conditions JSONB,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);
```

## API Usage

### Create a Bonus Rule

```javascript
POST /api/fantasy/scoring-rules

{
  "league_id": "SSPSLFLS16",
  "rule_name": "New Player Bonus",
  "rule_type": "goal",
  "points_value": 2,
  "is_bonus_rule": true,
  "bonus_conditions": {
    "condition_type": "new_player",
    "matches_count": 1
  }
}
```

## Future Enhancements

- [ ] Bonus rule stacking limits
- [ ] Mutual exclusivity rules
- [ ] Time-decay bonuses
- [ ] Team-based conditional bonuses
- [ ] Dynamic bonus calculation based on difficulty
- [ ] Bonus rule analytics/statistics

## Support

For questions or issues with bonus rules, refer to the main fantasy documentation or contact the development team.
