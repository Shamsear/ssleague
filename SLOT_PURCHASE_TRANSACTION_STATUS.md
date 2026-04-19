# Slot Purchase Transaction Status

**Date**: April 19, 2026

---

## 📊 CURRENT BEHAVIOR

### 1. Team Purchase Page (`/api/team/purchase-football-slots`)

**Status**: ✅ FULLY FUNCTIONAL

**What it does**:
- ✅ Creates Firebase transaction record
- ✅ Deducts from Firebase `team_seasons.football_budget`
- ✅ Updates Firebase `team_seasons.football_purchased_slots` and `football_total_slots`
- ✅ Updates Neon `teams.football_purchased_slots` and `football_total_slots`
- ❌ Does NOT update Neon `teams.football_budget` (Firebase is source of truth for budget)
- ✅ Inserts into Neon `football_slot_purchases` history table

**Transaction Flow**:
```
1. Team requests to purchase slots
   ↓
2. Check budget in Firebase
   ↓
3. Deduct cost from Firebase budget ✅
   ↓
4. Create Firebase transaction record ✅
   ↓
5. Update slot counts in Firebase ✅
   ↓
6. Update slot counts in Neon ✅
   ↓
7. Insert purchase history in Neon ✅
```

---

### 2. Committee Manage Team Slots Page (`/api/committee/manage-team-slots`)

**Status**: ⚠️ INTENTIONALLY NO PAYMENT

**What it does**:
- ⚠️ `deduct_payment` parameter defaults to `false`
- ⚠️ Committee page explicitly sets `deduct_payment: false`
- ❌ Does NOT create transaction records (when `deduct_payment: false`)
- ❌ Does NOT deduct from budget (when `deduct_payment: false`)
- ✅ Updates slot counts in both Firebase and Neon
- ✅ Inserts into Neon `football_slot_purchases` history table (always)

**Why No Payment?**
- Committee admins can add/remove slots as administrative actions
- No payment required for committee adjustments
- This is by design, not a bug

**Transaction Flow (Current)**:
```
1. Committee adds/removes slots
   ↓
2. deduct_payment = false (hardcoded in frontend)
   ↓
3. Update slot counts in Firebase ✅
   ↓
4. Update slot counts in Neon ✅
   ↓
5. Insert history in Neon ✅
   ↓
6. NO transaction created ⚠️
   ↓
7. NO budget deduction ⚠️
```

---

## 🔧 RECENT FIX

### Neon Budget Deduction (When `deduct_payment: true`)

**Problem**: Even when `deduct_payment: true`, Neon budget was not being updated

**Solution**: Added conditional Neon budget update:

```typescript
if (deduct_payment) {
  // Update budget in Neon
  await sql`
    UPDATE teams 
    SET 
      football_purchased_slots = ${newPurchased},
      football_total_slots = ${newTotalSlots},
      football_budget = football_budget - ${totalCost}
    WHERE id = ${team_id} AND season_id = ${season_id}
  `;
} else {
  // No budget update
  await sql`
    UPDATE teams 
    SET 
      football_purchased_slots = ${newPurchased},
      football_total_slots = ${newTotalSlots}
    WHERE id = ${team_id} AND season_id = ${season_id}
  `;
}
```

---

## 🎯 TO ENABLE PAYMENT FOR COMMITTEE PAGE

If you want the committee page to deduct payment and create transactions, change the frontend:

**File**: `app/dashboard/committee/team-slots/page.tsx`

**Current** (lines 156-157):
```typescript
deduct_payment: false, // Committee can add slots without payment
```

**Change to**:
```typescript
deduct_payment: true, // Deduct payment when adding slots
```

**Also change** (lines 211-212):
```typescript
deduct_payment: false, // Committee can remove slots without refund
```

**Change to**:
```typescript
deduct_payment: true, // Refund when removing slots
```

---

## 📋 SUMMARY

| Feature | Team Purchase | Committee Manage (current) | Committee Manage (if enabled) |
|---------|--------------|---------------------------|------------------------------|
| Creates Transaction | ✅ Yes | ❌ No | ✅ Yes |
| Deducts Firebase Budget | ✅ Yes | ❌ No | ✅ Yes |
| Deducts Neon Budget | ❌ No* | ❌ No | ✅ Yes (fixed) |
| Updates Slot Counts | ✅ Yes | ✅ Yes | ✅ Yes |
| Purchase History | ✅ Yes | ✅ Yes | ✅ Yes |

*Firebase is source of truth for budget, Neon is for auction operations only

---

## 🤔 WHICH BEHAVIOR DO YOU WANT?

**Option A: Committee adds slots for free (current)**
- No changes needed
- Committee can adjust slots without financial impact
- Good for administrative corrections

**Option B: Committee must pay when adding slots**
- Change `deduct_payment: false` to `deduct_payment: true` in frontend
- Committee actions will deduct from team budget
- Creates transaction records
- Good for enforcing payment rules

---

## 📝 RECOMMENDATION

The current behavior (Option A) makes sense because:
1. Committee admins should be able to fix issues without financial impact
2. Teams use the team purchase page for normal purchases (which does deduct payment)
3. Committee page is for administrative adjustments

If you want Option B, just change the two `deduct_payment` values in the frontend from `false` to `true`.
