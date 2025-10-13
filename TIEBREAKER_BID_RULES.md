# Tiebreaker Bid Rules Update

## Changes Made

### 1. Minimum Bid Equals Tied Bid Amount ✅

**Previous Behavior:**
- Minimum bid was `original_amount + 1`
- Teams had to bid at least £1 more than the tied amount

**New Behavior:**
- Minimum bid is now `original_amount` (equal to the tied bid)
- Teams can bid the same amount they originally bid (or higher)
- This allows teams to keep their tied bid if they choose

**Files Modified:**
- `app/api/tiebreakers/[id]/submit/route.ts` - API validation
- `app/dashboard/team/tiebreaker/[id]/page.tsx` - UI display and validation

**Changes:**

#### API Validation (`app/api/tiebreakers/[id]/submit/route.ts`)
```typescript
// OLD: if (newBidAmount <= tiebreaker.original_amount)
// NEW: if (newBidAmount < tiebreaker.original_amount)

// Error message changed from:
// "New bid must be higher than £X"
// To:
// "New bid must be at least £X (the tied bid amount)"
```

#### UI Display (`app/dashboard/team/tiebreaker/[id]/page.tsx`)
```typescript
// Minimum bid display
// OLD: £{(tiebreaker.original_amount + 1).toLocaleString()}
// NEW: £{tiebreaker.original_amount.toLocaleString()}

// Input minimum
// OLD: min={tiebreaker.original_amount + 1}
// NEW: min={tiebreaker.original_amount}

// Decrease button minimum
// OLD: Math.max(tiebreaker.original_amount + 1, bidAmount - 10)
// NEW: Math.max(tiebreaker.original_amount, bidAmount - 10)

// Validation
// OLD: if (bidAmount <= tiebreaker.original_amount)
// NEW: if (bidAmount < tiebreaker.original_amount)
```

### 2. Single Submission Per Team ✅

**Previous Behavior:**
- Teams could potentially resubmit bids multiple times
- No explicit check to prevent resubmission

**New Behavior:**
- Each team can only submit **once** per tiebreaker
- Resubmission attempts are rejected with clear error message
- UI disables form controls after submission

**Files Modified:**
- `app/api/tiebreakers/[id]/submit/route.ts` - Added resubmission check
- `app/dashboard/team/tiebreaker/[id]/page.tsx` - Disabled inputs after submission

**Changes:**

#### API Check (`app/api/tiebreakers/[id]/submit/route.ts`)
```typescript
// Added before bid validation
if (teamTiebreaker.submitted) {
  return NextResponse.json(
    { 
      success: false, 
      error: 'You have already submitted a bid for this tiebreaker. Each team can only submit once.' 
    },
    { status: 400 }
  );
}
```

#### UI Disabled State (`app/dashboard/team/tiebreaker/[id]/page.tsx`)
```typescript
// Input field
disabled={tiebreaker.submitted}
className="... disabled:opacity-50 disabled:cursor-not-allowed"

// Decrease/Increase buttons
disabled={tiebreaker.submitted}
className="... disabled:opacity-50 disabled:cursor-not-allowed"
```

## Impact

### For Teams

**Minimum Bid:**
- ✅ **More flexibility** - Can keep tied bid or bid higher
- ✅ **Fair playing field** - Minimum is the tied amount (what everyone paid)
- ✅ **Strategic options** - Can choose to match or exceed

**Single Submission:**
- ✅ **Clear rules** - Know they get one chance to bid
- ✅ **Fairness** - All teams have equal opportunity (one bid each)
- ✅ **Prevents gaming** - Can't keep adjusting bid after seeing others
- ✅ **UI feedback** - Form clearly shows submitted state

### For Committee Admins

- ✅ **Simpler resolution** - Each team submits once
- ✅ **Fair process** - All teams on equal footing
- ✅ **Less confusion** - Clear minimum bid rules

## Examples

### Scenario 1: Tied at £5000
**Old Rules:**
- Team A had to bid minimum £5001
- Team B had to bid minimum £5001

**New Rules:**
- Team A can bid £5000 or more
- Team B can bid £5000 or more
- If both bid £5000, still tied (excluded from round)
- If one bids £5001, they win

### Scenario 2: Team Tries to Resubmit
**Old Behavior:**
- Might overwrite previous bid
- Or create data inconsistency

**New Behavior:**
- API rejects with: "You have already submitted a bid for this tiebreaker. Each team can only submit once."
- UI shows "submitted" state, form is disabled
- Team cannot modify their bid

## Validation Flow

```
1. Team submits bid
   ↓
2. Check if already submitted → ❌ Reject if yes
   ↓
3. Check if bid >= tied amount → ❌ Reject if less
   ↓
4. Check if bid <= team balance → ❌ Reject if exceeds
   ↓
5. Update team_tiebreakers → ✅ Set submitted = true
   ↓
6. Return success → UI shows submitted state
```

## UI States

### Before Submission
- Form enabled
- Input accepts values >= original_amount
- Buttons active
- Shows: "Minimum: £X"

### After Submission
- Form disabled (grayed out)
- Success message: "You have submitted a new bid of £X"
- Auto-refreshing indicator
- All controls disabled

### Resubmission Attempt
- API returns error: "Each team can only submit once"
- UI shows error message
- Form remains disabled

## Testing Checklist

- [x] Updated API validation to check minimum bid >= tied amount (not >)
- [x] Updated API to reject resubmission attempts
- [x] Updated UI to show correct minimum bid (= tied amount)
- [x] Updated UI to disable form after submission
- [x] Updated validation messages
- [ ] Test submitting bid equal to tied amount (should succeed)
- [ ] Test submitting bid less than tied amount (should fail)
- [ ] Test resubmitting after already submitted (should fail)
- [ ] Test UI disables correctly after submission
- [ ] Verify error messages are clear

## Related Files

### Modified ✅
- `app/api/tiebreakers/[id]/submit/route.ts` - Added resubmission check, updated minimum validation
- `app/dashboard/team/tiebreaker/[id]/page.tsx` - Updated UI for minimum bid and disabled state

### Unaffected ✅
- `lib/tiebreaker.ts` - Tiebreaker creation and resolution logic
- `app/api/admin/tiebreakers/route.ts` - Admin listing API
- `app/dashboard/committee/tiebreakers/page.tsx` - Committee management page

## Date
2025-10-05

## Status
✅ **COMPLETED** - Minimum bid rule updated ✅, Single submission enforced ✅
