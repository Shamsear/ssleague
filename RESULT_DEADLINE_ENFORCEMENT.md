# Result Entry Deadline Enforcement

## Overview

The system now enforces result entry deadlines at the **server-side API level**, preventing teams from submitting results after the deadline has passed.

## Implementation

### API Validation

Two API endpoints now validate the result entry deadline before accepting submissions:

1. **`/api/fixtures/[fixtureId]/matchups` (PATCH)** - Lines 179-227
   - Validates deadline before accepting match results
   - Returns `403 Forbidden` if deadline passed

2. **`/api/fixtures/[fixtureId]` (PATCH)** - Lines 55-103
   - Validates deadline before accepting MOTM and penalty goals
   - Returns `403 Forbidden` if deadline passed

### Deadline Calculation

```typescript
// Get round deadlines from database
const deadlines = await sql`
  SELECT scheduled_date, result_entry_deadline_time, result_entry_deadline_day_offset
  FROM round_deadlines
  WHERE season_id = ${season_id}
  AND round_number = ${round_number}
  AND leg = ${leg}
`;

// Calculate result entry deadline
const resultDate = new Date(deadline.scheduled_date);
resultDate.setDate(resultDate.getDate() + (deadline.result_entry_deadline_day_offset || 2));
const resultDateStr = resultDate.toISOString().split('T')[0];
const resultDeadline = new Date(`${resultDateStr}T${deadline.result_entry_deadline_time}:00+05:30`);

// Check if deadline has passed
if (now >= resultDeadline) {
  return NextResponse.json(
    { 
      error: 'Result entry deadline has passed',
      deadline: resultDeadline.toISOString()
    },
    { status: 403 }
  );
}
```

### Frontend Handling

The frontend now properly handles deadline errors:

```typescript
if (!response.ok) {
  const errorData = await response.json();
  if (response.status === 403) {
    // Deadline passed
    showAlert({
      type: 'error',
      title: 'Deadline Passed',
      message: `❌ ${errorData.error}. Results can no longer be submitted.`
    });
    setIsSaving(false);
    setIsResultMode(false);
    return;
  }
  throw new Error(errorData.error || 'Failed to save results');
}
```

## How It Works

### Team Perspective

1. **Before Deadline**
   - Phase: `result_entry`
   - Teams can submit/edit results normally
   - API accepts submissions

2. **After Deadline**
   - Phase: `closed`
   - Result entry UI is hidden
   - Even if UI is bypassed, API rejects with `403 Forbidden`
   - User sees: "Result entry deadline has passed"

### Committee Admin Perspective

Committee admins can still edit results after the deadline using the dedicated endpoint:

- **`/api/fixtures/[fixtureId]/edit-result`** (PATCH)
- This endpoint does NOT check deadlines
- Allows committee to correct errors at any time

## Error Responses

### 403 Forbidden - Deadline Passed

```json
{
  "error": "Result entry deadline has passed",
  "deadline": "2025-01-15T18:30:00.000Z"
}
```

### 404 Not Found - Fixture Not Found

```json
{
  "error": "Fixture not found"
}
```

### 400 Bad Request - Invalid Data

```json
{
  "error": "Invalid results data"
}
```

## Security Benefits

✅ **Server-side enforcement** - Cannot be bypassed by frontend manipulation
✅ **Consistent deadline logic** - Same calculation as frontend phase detection
✅ **Clear error messages** - Users understand why submission failed
✅ **Committee override** - Admins can still correct mistakes via edit-result endpoint

## Testing

To test deadline enforcement:

1. Set result entry deadline to past time in `round_deadlines` table
2. Try submitting results from team fixture page
3. Should see "Deadline Passed" error
4. Verify API returns 403 status
5. Confirm committee admin can still edit via edit-result endpoint

## Database Schema

The deadline is determined by:

```sql
CREATE TABLE round_deadlines (
  season_id VARCHAR(255) NOT NULL,
  round_number INTEGER NOT NULL,
  leg VARCHAR(20) NOT NULL,
  scheduled_date DATE,
  result_entry_deadline_time TIME DEFAULT '00:30',
  result_entry_deadline_day_offset INTEGER DEFAULT 2,
  ...
);
```

**Example:**
- `scheduled_date`: `2025-01-10`
- `result_entry_deadline_day_offset`: `2` (days after match)
- `result_entry_deadline_time`: `00:30` (IST)
- **Deadline:** `2025-01-12 00:30 IST`

## Future Enhancements

- [ ] Add role-based bypass (committee_admin can submit after deadline)
- [ ] Add grace period configuration (e.g., 15 minutes after deadline)
- [ ] Log deadline violations for audit trail
- [ ] Send notification when deadline approaches
- [ ] Allow committee to extend deadline for specific fixtures

---

**Implementation Date:** 2025-11-02
**Status:** ✅ Implemented and Tested
