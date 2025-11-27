# Tiebreaker Manual Mode Status Fix

## Issue
Round stuck in `tiebreaker_pending` status after tiebreaker was resolved in manual finalization mode.

**Example:**
```
Round ID: SSPSLFR00002
Status: tiebreaker_pending (stuck)
Mode: manual
Issue: Tiebreaker resolved but status not updated
```

## Root Cause
When a tiebreaker is resolved in **manual finalization mode**, the system:
1. ✅ Resolves the tiebreaker correctly
2. ✅ Calls `finalizeRound()` to calculate allocations
3. ❌ **MISSING**: Doesn't store pending allocations in database
4. ❌ **MISSING**: Doesn't update round status to `pending_finalization`

This only affected manual mode because auto mode has different logic that applies results immediately.

## Solution
Updated `app/api/tiebreakers/[id]/submit/route.ts` to match the behavior of `app/api/admin/rounds/[id]/preview-finalization/route.ts`:

### Changes Made
After successful finalization in manual mode, the system now:
1. Stores allocations in `pending_allocations` table
2. Updates round status: `tiebreaker_pending` → `pending_finalization`

### Code Location
File: `app/api/tiebreakers/[id]/submit/route.ts`
Lines: ~323-350

### Status Flow (Manual Mode)
```
active 
  → expired_pending_finalization (timer expires)
  → tiebreaker_pending (tie detected during preview)
  → pending_finalization (tiebreaker resolved) ✅ FIXED
  → completed (committee approves)
```

## Testing
To verify the fix:
1. Create a round with `finalization_mode = 'manual'`
2. Create a tie scenario (2+ teams bid same amount)
3. Resolve the tiebreaker
4. Check round status - should be `pending_finalization`, not stuck in `tiebreaker_pending`
5. Committee can now see preview and approve finalization

## Related Files
- `app/api/tiebreakers/[id]/submit/route.ts` - Fixed
- `app/api/admin/rounds/[id]/preview-finalization/route.ts` - Reference implementation
- `lib/finalize-round.ts` - Core finalization logic (unchanged)
