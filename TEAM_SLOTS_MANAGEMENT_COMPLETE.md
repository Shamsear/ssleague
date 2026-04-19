# Team Slots Management - Complete Implementation

**Date**: April 19, 2026  
**Status**: ✅ COMPLETE

---

## 🎯 WHAT WAS FIXED

The team slots management page (`/dashboard/committee/team-slots`) was only updating Firebase, but NOT:
1. ❌ Updating the Neon `teams` table
2. ❌ Creating transaction records in `football_slot_purchases`
3. ❌ Optionally deducting/refunding eCoins

---

## ✅ SOLUTION

### Created New API Endpoint

**File**: `app/api/committee/manage-team-slots/route.ts`

This endpoint handles the complete slot management flow:

1. **Validates the request**:
   - Checks team and season exist
   - Validates slot limits (max purchasable)
   - Ensures removing slots won't go below current player count
   - Checks budget if payment is required

2. **Updates Firebase**:
   - Updates `team_seasons` document with new slot counts
   - Optionally updates `football_budget` if payment is involved
   - Creates transaction record in `transactions` collection

3. **Updates Neon Database**:
   - Updates `teams` table with new slot counts
   - Inserts record into `football_slot_purchases` history table

4. **Flexible Payment Options**:
   - `deduct_payment: true` - Charges/refunds eCoins
   - `deduct_payment: false` - Committee can adjust slots without payment

---

## 📋 API ENDPOINT DETAILS

### POST `/api/committee/manage-team-slots`

**Request Body**:
```json
{
  "team_id": "SSPSLT0002",
  "season_id": "SSPSLS17",
  "slots_change": 2,           // Positive to add, negative to remove
  "deduct_payment": false,     // Optional: true to charge/refund eCoins
  "notes": "Committee adjustment"  // Optional: reason for change
}
```

**Response**:
```json
{
  "success": true,
  "message": "Successfully added 2 slots",
  "data": {
    "slots_change": 2,
    "new_purchased_slots": 2,
    "new_total_slots": 27,
    "cost": 0,
    "new_budget": 1000
  }
}
```

---

## 🔄 DATA FLOW

### Adding Slots:
```
1. Committee clicks "+1" button
   ↓
2. API validates request
   ↓
3. Update Firebase team_seasons:
   - football_purchased_slots: +1
   - football_total_slots: +1
   - (optional) football_budget: -10
   ↓
4. Create Firebase transaction record (if payment)
   ↓
5. Update Neon teams table:
   - football_purchased_slots: +1
   - football_total_slots: +1
   ↓
6. Insert into football_slot_purchases history
   ↓
7. Return success ✅
```

### Removing Slots:
```
1. Committee clicks "-1" button
   ↓
2. API validates:
   - Team has purchased slots to remove
   - Won't go below current player count
   ↓
3. Update Firebase team_seasons:
   - football_purchased_slots: -1
   - football_total_slots: -1
   - (optional) football_budget: +10 (refund)
   ↓
4. Create Firebase transaction record (if refund)
   ↓
5. Update Neon teams table:
   - football_purchased_slots: -1
   - football_total_slots: -1
   ↓
6. Insert into football_slot_purchases history (negative)
   ↓
7. Return success ✅
```

---

## 📊 DATABASE UPDATES

### Firebase `team_seasons` Collection:
```javascript
{
  football_base_slots: 25,
  football_purchased_slots: 2,  // ← Updated
  football_total_slots: 27,     // ← Updated
  football_budget: 990,         // ← Updated (if payment)
  updated_at: Timestamp
}
```

### Firebase `transactions` Collection (if payment):
```javascript
{
  team_id: "SSPSLT0002",
  season_id: "SSPSLS17",
  type: "slot_purchase",        // or "slot_refund"
  amount: -20,                  // Negative for deduction
  currency: "ecoin",
  description: "Purchased 2 football player slots",
  slots_purchased: 2,
  price_per_slot: 10,
  created_by: "committee_admin",
  notes: "Committee adjustment",
  created_at: Timestamp
}
```

### Neon `teams` Table:
```sql
UPDATE teams 
SET 
  football_purchased_slots = 2,  -- Updated
  football_total_slots = 27      -- Updated
WHERE id = 'SSPSLT0002' AND season_id = 'SSPSLS17'
```

### Neon `football_slot_purchases` Table:
```sql
INSERT INTO football_slot_purchases (
  team_id, season_id, slots_purchased, price_per_slot, total_cost, notes, created_by
) VALUES (
  'SSPSLT0002', 'SSPSLS17', 2, 10, 20, 'Committee added slots', 'committee_admin'
)
```

---

## 🎨 UI UPDATES

### Updated Page: `app/dashboard/committee/team-slots/page.tsx`

**Changes**:
1. Replaced direct Firebase updates with API calls
2. Added proper error handling
3. Shows success/error messages from API
4. Updates local state after successful API call

**Before**:
```typescript
// Direct Firebase update (incomplete)
await updateDoc(teamSeasonRef, {
  football_purchased_slots: newPurchased,
  football_total_slots: newTotal
})
```

**After**:
```typescript
// Complete API call
const response = await fetchWithTokenRefresh('/api/committee/manage-team-slots', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    team_id: teamId,
    season_id: currentSeasonId,
    slots_change: slotsToAdd,
    deduct_payment: false,
    notes: `Committee added ${slotsToAdd} slot(s)`
  })
})
```

---

## 🔒 VALIDATION & SAFETY

### Adding Slots:
- ✅ Cannot exceed `max_purchasable` limit (default: 3)
- ✅ Checks budget if payment is required
- ✅ Creates audit trail in history table

### Removing Slots:
- ✅ Cannot remove more slots than purchased
- ✅ Cannot go below current player count
- ✅ Prevents negative purchased slots
- ✅ Creates audit trail (negative entry)

---

## 💰 PAYMENT OPTIONS

### Committee Mode (Default):
```javascript
deduct_payment: false
```
- Committee can add/remove slots freely
- No eCoin charges or refunds
- Used for administrative adjustments
- Still creates history records

### Payment Mode:
```javascript
deduct_payment: true
```
- Charges eCoins when adding slots
- Refunds eCoins when removing slots
- Validates budget before charging
- Creates transaction records
- Used when teams purchase slots themselves

---

## 📈 BENEFITS

1. **Data Consistency**: Both Firebase and Neon stay in sync
2. **Audit Trail**: Every change is logged in `football_slot_purchases`
3. **Transaction Records**: Financial tracking in `transactions` collection
4. **Flexibility**: Committee can adjust without payment, or charge teams
5. **Safety**: Comprehensive validation prevents invalid states
6. **History**: Full audit trail of all slot changes

---

## 🧪 TESTING

To test the implementation:

1. **Add Slots**:
   - Go to `/dashboard/committee/team-slots`
   - Click "+1" on any team
   - Verify: Firebase updated, Neon updated, history created

2. **Remove Slots**:
   - Click "-1" on a team with purchased slots
   - Verify: Slots removed, cannot go below player count

3. **Check History**:
   ```sql
   SELECT * FROM football_slot_purchases 
   WHERE team_id = 'SSPSLT0002' 
   ORDER BY created_at DESC;
   ```

4. **Check Transactions** (if payment enabled):
   ```javascript
   db.collection('transactions')
     .where('type', 'in', ['slot_purchase', 'slot_refund'])
     .orderBy('created_at', 'desc')
     .get()
   ```

---

## 📁 FILES MODIFIED

- ✅ `app/api/committee/manage-team-slots/route.ts` - NEW API endpoint
- ✅ `app/dashboard/committee/team-slots/page.tsx` - Updated to use API
- ✅ `app/api/bulk-rounds/[id]/team-summary/route.ts` - Now uses dynamic slots

---

## 🎉 RESULT

The team slots management system is now fully functional:
- ✅ Updates both Firebase and Neon databases
- ✅ Creates transaction records
- ✅ Maintains audit trail
- ✅ Supports payment or free adjustments
- ✅ Comprehensive validation
- ✅ Integrated with dynamic slot system

**Status**: PRODUCTION READY
