# Lineup Deadline Mismatch Fix

## Problem
The fixture page shows "Lineup Submission Open" with a deadline, but when clicking to submit lineup, it says "Deadline Passed". This is because:

1. **Fixture page** (`app/dashboard/team/fixture/[fixtureId]/page.tsx`) calculates deadline based on `round_start_time`
2. **Lineup validation** (`lib/lineup-validation.ts`) returns early if `fixture_status !== 'scheduled'`

## Root Cause
In `lib/lineup-validation.ts`, the `isLineupEditable` function checks:
```typescript
if (fixture.fixture_status && fixture.fixture_status !== 'scheduled') {
  return { 
    editable: false, 
    reason: 'Lineup locked - fixture has been generated'
  };
}
```

This means if the fixture status is anything other than 'scheduled' (like 'pending', 'upcoming', etc.), it immediately returns `editable: false` **before** checking the actual deadline times.

## Solution
The `isLineupEditable` function should:
1. Remove or modify the early return for fixture_status
2. Always calculate deadlines based on round_deadlines
3. Check if current time is before the appropriate deadline

## Current Behavior
- Fixture shows: "Match: 2026-01-28T18:30:00.000Z, Deadline: 05:00 pm IST"
- Lineup page shows: "Deadline Passed" (because fixture_status check returns early)

## Expected Behavior
Both pages should show the same deadline status based on the actual round_start_time/deadline times.

## Fix Required
Update `lib/lineup-validation.ts` line ~180 to either:
1. Remove the fixture_status check entirely, OR
2. Only block if fixture_status is 'completed' or 'finalized'

The fixture_status should not prevent lineup submission if the deadline hasn't passed yet.
