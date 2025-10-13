# Minimum Bid Amount Update

## Change Summary

**Old Minimum:** £100  
**New Minimum:** £10  

The minimum bid amount has been updated to allow teams to place bids starting from £10 instead of £100.

---

## What Was Changed

### 1. Database Constraint ✅
- **File:** `database/migrations/blind-bidding-system.sql` (line 37)
- **Change:** Updated CHECK constraint from `amount >= 100` to `amount >= 10`
- **Status:** ✅ Migrated successfully

### 2. Migration Script ✅
- **File:** `database/migrations/update-minimum-bid-amount.sql`
- **Description:** SQL migration to drop old constraint and add new one
- **Status:** ✅ Created

### 3. Node Migration Script ✅
- **File:** `scripts/update-minimum-bid.js`
- **Description:** Node.js script to run the migration
- **Status:** ✅ Executed successfully

### 4. API Validation ✅
- **File:** `app/api/team/bids/route.ts` (lines 46-51)
- **Validation:** Already validates minimum of £10
- **Status:** ✅ Already correct (no changes needed)

---

## Migration Details

### Database Constraint Update

```sql
-- Drop the old constraint
ALTER TABLE bids DROP CONSTRAINT IF EXISTS bids_amount_check;

-- Add new constraint with minimum of 10
ALTER TABLE bids ADD CONSTRAINT bids_amount_check CHECK (amount >= 10);
```

### Verification

After running the migration, the constraint was verified:

```
Constraint Name: bids_amount_check
Definition: CHECK ((amount >= 10))
```

---

## Files Modified

| File | Change | Status |
|------|--------|--------|
| `database/migrations/blind-bidding-system.sql` | Updated base schema | ✅ |
| `database/migrations/update-minimum-bid-amount.sql` | Created migration | ✅ |
| `scripts/update-minimum-bid.js` | Created migration runner | ✅ |
| `app/dashboard/team/round/[id]/page.tsx` | Updated UI validation and input min | ✅ |

---

## Frontend UI Changes

### Team Round Page (`app/dashboard/team/round/[id]/page.tsx`)

**Changes Made:**
1. Line 540: Updated validation from `amount < 100` to `amount < 10`
2. Line 541: Updated error message from "£100" to "£10"
3. Line 657: Updated HTML input min attribute from `min="100"` to `min="10"`

```typescript
// Before:
if (!amount || isNaN(amount) || amount < 100) {
  alert('Bid amount must be at least £100');
  return;
}

// After:
if (!amount || isNaN(amount) || amount < 10) {
  alert('Bid amount must be at least £10');
  return;
}
```

```html
<!-- Before: -->
<input type="number" min="100" />

<!-- After: -->
<input type="number" min="10" />
```

---

## Files Already Correct

These files already had the correct minimum bid validation:

| File | Line | Validation |
|------|------|------------|
| `app/api/team/bids/route.ts` | 46-50 | `if (amount < 10)` |
| `app/api/team/tiebreakers/route.ts` | 87 | Checks minimum 10 |
| `lib/tiebreaker.ts` | 117 | Validates minimum 10 |
| `app/dashboard/team/tiebreaker/[id]/page.tsx` | 137 | Validates against tied amount |

---

## Impact

### ✅ Teams Can Now:
- Place bids starting from £10
- Be more strategic with smaller budget amounts
- Participate even with limited remaining budget

### ✅ Backward Compatibility:
- All existing bids remain valid (they were already >= 100)
- No data migration needed for existing records
- Only the constraint for future bids is updated

---

## Testing

To verify the change works:

1. **Login as a team**
2. **Navigate to an active round**
3. **Try to place a bid:**
   - ✅ £10 should be accepted
   - ✅ £50 should be accepted
   - ❌ £9 should be rejected (below minimum)
   - ❌ £0 should be rejected

---

## Running the Migration

### Option 1: Node Script (Recommended)
```bash
node scripts/update-minimum-bid.js
```

### Option 2: SQL File
```bash
psql $DATABASE_URL -f database/migrations/update-minimum-bid-amount.sql
```

---

## Date
2025-10-05

## Status
✅ **COMPLETED** - Minimum bid amount updated to £10
