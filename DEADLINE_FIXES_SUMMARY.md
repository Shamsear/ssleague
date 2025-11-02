# Deadline Enforcement & Match Days Display - Fix Summary

## Issues Fixed

### 1. **Result Entry Deadline Bypass** ✅
**Problem:** Teams could submit results after the deadline if they had the modal already open.

**Solution:** Added server-side validation in API endpoints:
- `/api/fixtures/[fixtureId]/matchups` (PATCH) - Lines 179-227
- `/api/fixtures/[fixtureId]` (PATCH) - Lines 55-103

**Implementation:**
```typescript
// Check result entry deadline
const deadlines = await sql`
  SELECT scheduled_date, result_entry_deadline_time, result_entry_deadline_day_offset
  FROM round_deadlines
  WHERE season_id = ${season_id} AND round_number = ${round_number} AND leg = ${leg}
`;

if (now >= resultDeadline) {
  return NextResponse.json(
    { error: 'Result entry deadline has passed', deadline: resultDeadline.toISOString() },
    { status: 403 }
  );
}
```

### 2. **Edit Results Button Visible After Deadline** ✅
**Problem:** "Edit Results" button was always visible, even in closed phase.

**Solution:** Wrapped button in phase check (fixture page line 1876):
```tsx
{phase === 'result_entry' && (
  <button onClick={...}>✏️ Edit Results</button>
)}

{/* Deadline Passed Message */}
{phase === 'closed' && matchups.some(m => m.home_goals !== null) && (
  <div className="p-4 bg-gray-100 border-2 border-gray-300 rounded-xl text-center">
    <p className="text-sm font-semibold text-gray-700">🔒 Result entry period has ended</p>
    <p className="text-xs text-gray-600 mt-1">Results cannot be modified after the deadline</p>
  </div>
)}
```

### 3. **Confusing "Result: Day 1" Display** ✅
**Problem:** Match days page showed "Result: Day 1" which was just the offset value, not the actual deadline.

**Solution:** Display actual deadline date and time:

**Before:**
```
Result: Day 1
```

**After:**
```
Result: 03/11 00:30  (shows actual deadline date/time)
```

**Implementation (lines 783-790 & 1073-1080):**
```tsx
<span className="font-medium">Result:</span> {(() => {
  if (!round.scheduled_date) return 'Not scheduled';
  const offsetDays = round.result_entry_deadline_day_offset || 2;
  const scheduledDate = new Date(round.scheduled_date);
  const resultDate = new Date(scheduledDate.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  const dateStr = resultDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
  return `${dateStr} ${round.result_entry_deadline_time || '00:30'}`;
})()}
```

### 4. **Unclear "Closed" vs "Expired" Status** ✅
**Problem:** Phase label showed "Closed" with "Expired" but didn't indicate how long ago it expired.

**Solution:** Show time since deadline passed:

**Before:**
```
Phase: Closed
Status: Expired
```

**After:**
```
Phase: Result Entry Closed
Status: Expired 2h ago  (or "Just expired", "Expired 1d ago")
```

**Implementation (lines 703-723 & 1010-1030):**
```typescript
const timeSinceDeadline = now.getTime() - resultDeadline.getTime();
const hoursPassed = Math.floor(timeSinceDeadline / (1000 * 60 * 60));
const daysPassed = Math.floor(hoursPassed / 24);

let expiredMsg = 'Expired';
if (daysPassed > 0) {
  expiredMsg = `Expired ${daysPassed}d ago`;
} else if (hoursPassed > 0) {
  expiredMsg = `Expired ${hoursPassed}h ago`;
} else {
  expiredMsg = 'Just expired';
}

return {
  phase: 'closed',
  phaseLabel: 'Result Entry Closed',
  color: 'bg-red-100 text-red-700',
  deadline: null,
  remaining: expiredMsg
};
```

## Files Modified

1. **`app/api/fixtures/[fixtureId]/matchups/route.ts`**
   - Added deadline validation before accepting result submissions
   - Returns 403 Forbidden if deadline passed

2. **`app/api/fixtures/[fixtureId]/route.ts`**
   - Added deadline validation before accepting MOTM/penalty goals
   - Returns 403 Forbidden if deadline passed

3. **`app/dashboard/team/fixture/[fixtureId]/page.tsx`**
   - Fixed "Edit Results" button to only show during result_entry phase
   - Added "Deadline Passed" message when phase is closed
   - Added proper error handling for 403 deadline errors

4. **`app/dashboard/committee/team-management/match-days/page.tsx`**
   - Changed "Result: Day X" to show actual deadline date/time
   - Improved phase label from "Closed" to "Result Entry Closed"
   - Added time-since-expiry display (e.g., "Expired 2h ago")

## User Experience Improvements

### For Teams:
- ✅ Clear indication when result entry is open vs closed
- ✅ Can't bypass deadline even if modal is open
- ✅ Helpful error message if they try to submit after deadline
- ✅ "Deadline Passed" banner instead of clickable button

### For Committee Admins:
- ✅ See actual result deadline date/time instead of offset value
- ✅ See how long ago deadline expired
- ✅ Clearer phase labels ("Result Entry Closed" vs just "Closed")
- ✅ Can still edit results via dedicated `/edit-result` endpoint (no deadline check)

## Testing Checklist

- [x] Submit result before deadline → Success
- [x] Submit result after deadline → 403 Error with clear message
- [x] Edit Results button hidden when phase is closed
- [x] Match days page shows actual deadline date/time
- [x] Match days page shows time since expiry
- [x] Committee can still edit via edit-result endpoint
- [x] Frontend properly handles 403 errors from API

## Security

✅ **Server-side enforcement** - Cannot be bypassed by frontend manipulation  
✅ **Consistent deadline logic** - Same calculation across fixture page, match days page, and API  
✅ **Clear error responses** - Users understand why submission failed  
✅ **Committee override preserved** - Admins can still correct mistakes via dedicated endpoint

---

**Implementation Date:** 2025-11-02  
**Status:** ✅ Complete & Tested
