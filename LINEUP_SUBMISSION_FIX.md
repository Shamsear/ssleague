# Lineup Submission Fix

## Issue
The lineup submission was showing "Deadline passed" even when teams should be able to edit their lineups during the fixture entry phase.

## Root Cause
The `canSubmitLineup` calculation was only checking:
```typescript
const canSubmit = now < lineupDeadlineTime && matchupsList.length === 0;
```

This didn't account for:
1. Home team editing before home deadline (even with matchups)
2. Both teams editing during fixture_entry phase (after home deadline, no matchups)

## Solution
Updated the logic to handle all scenarios:

```typescript
// Calculate lineup submission permissions
// 1. Before round start: anyone can submit (if no matchups)
// 2. Home team: can submit until home deadline (even if matchups exist)
// 3. After home deadline: if no matchups, both teams can submit until away deadline

const homeDeadlineTime = new Date(`${deadlines.scheduled_date}T${deadlines.home_fixture_deadline_time}:00+05:30`);
const awayDeadlineTime = new Date(`${deadlines.scheduled_date}T${deadlines.away_fixture_deadline_time}:00+05:30`);

let canSubmit = false;

if (matchupsList.length > 0) {
  // Matchups exist - only home team can edit before home deadline
  if (isHome && now < homeDeadlineTime) {
    canSubmit = true; // Will delete matchups
  }
} else {
  // No matchups yet
  if (now < homeDeadlineTime) {
    canSubmit = true; // Anyone can submit
  } else if (now < awayDeadlineTime) {
    canSubmit = true; // Both teams can submit (fixture entry phase)
  }
}
```

## Result
Now the lineup submission correctly allows:
- ✅ Home team to edit before home deadline
- ✅ Both teams to edit during fixture_entry phase (if no matchups)
- ✅ Proper locking once matchups are created (except home team before home deadline)

## Testing
1. Before home deadline: Both teams can submit ✅
2. Home team with matchups (before home deadline): Can edit ✅
3. After home deadline, no matchups: Both teams can edit ✅
4. After home deadline, with matchups: Locked ✅
5. After away deadline: Locked ✅
