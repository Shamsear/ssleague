# Team Slot Purchase Feature - Complete

**Date**: April 19, 2026  
**Status**: ✅ COMPLETE

---

## 🎯 OVERVIEW

Added slot purchase functionality to the team bulk round page, allowing teams to purchase additional squad slots directly during bidding. This mirrors the committee admin functionality but with team-specific restrictions.

---

## ✅ FEATURES IMPLEMENTED

### 1. Team Slot Purchase API

**File**: `app/api/team/manage-slots/route.ts`

**Functionality**:
- Teams can purchase additional slots (ADD ONLY)
- Validates against maximum purchasable limit
- Checks team balance before purchase
- Deducts payment from team budget
- Creates transaction record in Firebase
- Updates both Firebase and Neon databases
- Records purchase history in `football_slot_purchases` table

**Security**:
- Team role authentication required
- Uses JWT claims (zero Firebase reads for auth)
- Validates team ownership
- Prevents exceeding max purchasable slots

**Key Features**:
- ✅ Payment deduction (both Firebase and Neon)
- ✅ Transaction logging
- ✅ Purchase history tracking
- ✅ Balance validation
- ✅ Slot limit validation

---

### 2. Team Bulk Round Page Updates

**File**: `app/dashboard/team/bulk-round/[id]/page.tsx`

**UI Components Added**:

1. **+Buy Button** in Squad Info Card
   - Shows when team hasn't reached max purchasable slots
   - Opens slot purchase modal
   - Positioned next to "current" text

2. **Slot Purchase Modal**
   - Shows current slot status (current/max/purchased/available)
   - Displays purchase details (price, balance, after purchase)
   - Warning section with important notes
   - Confirmation required before purchase
   - Disabled when insufficient balance or max reached

**State Management**:
- `slotSettings`: Max purchasable and price per slot
- `purchasedSlots`: Current purchased slots count
- `showSlotPurchase`: Modal visibility

**Purchase Flow**:
1. User clicks "+Buy" button
2. Modal opens with current status and warnings
3. User confirms purchase
4. API call to `/api/team/manage-slots`
5. Local state updated on success
6. Success message shown
7. Modal closes

---

### 3. Bulk Round API Updates

**File**: `app/api/team/bulk-rounds/[id]/route.ts`

**Data Added to Response**:
- `slot_settings`: { maxPurchasable, slotPrice }
- `purchased_slots`: Current purchased slots count
- `season_id`: Added to round object for API calls

**Data Sources**:
- Slot settings from Firebase seasons collection
- Purchased slots from Neon teams table
- Fetched alongside existing team data

---

## 🎨 UI/UX FEATURES

### Squad Info Card Enhancement
```
Squad
22/25
current  +Buy
```

### Slot Purchase Modal Sections

1. **Current Status** (Gray background)
   - Current Slots: 25
   - Purchased: 0/3
   - Players: 22
   - Available: 3

2. **Purchase Details** (Blue background)
   - Slot Price: £10
   - Your Balance: £1805
   - After Purchase: £1795

3. **Warning Section** (Yellow background)
   - Purchased slots are permanent
   - Cannot remove slots once purchased
   - Only admins can remove slots
   - Transaction will be recorded

4. **Action Buttons**
   - Cancel (gray)
   - Purchase £10 (blue, disabled if insufficient balance)

---

## ⚠️ RESTRICTIONS & WARNINGS

### Team Restrictions
1. **ADD ONLY**: Teams can only add slots, never remove
2. **Max Limit**: Cannot exceed `football_max_purchasable_slots` (default: 3)
3. **Balance Check**: Must have sufficient balance
4. **Permanent**: Slots cannot be removed by teams

### Admin Capabilities
- Admins can both add AND remove slots
- Admins can override max purchasable limit
- Admins can manage slots for any team

### Warning Messages
Teams see clear warnings:
- "Once purchased, slots cannot be removed by teams"
- "Only admins can remove slots"
- "Purchased slots are permanent for this season"

---

## 🔄 DATA FLOW

### Purchase Flow

1. **Frontend** (Team Bulk Round Page)
   ```
   User clicks +Buy → Modal opens → User confirms
   ```

2. **API Call** (`/api/team/manage-slots`)
   ```
   POST { slots_to_add: 1, season_id: 'SSPSLS17' }
   ```

3. **Validation**
   ```
   - Check max purchasable limit
   - Check team balance
   - Calculate cost
   ```

4. **Database Updates**
   ```
   Firebase:
   - Update team_season (slots, budget, spent)
   - Create transaction record
   
   Neon:
   - Update teams table (slots, budget, spent)
   - Insert into football_slot_purchases
   ```

5. **Response**
   ```json
   {
     "success": true,
     "message": "Successfully purchased 1 slot(s) for £10",
     "data": {
       "slots_added": 1,
       "new_purchased_slots": 1,
       "new_total_slots": 26,
       "cost": 10,
       "new_budget": 1795,
       "transaction_created": true,
       "budget_deducted": true
     }
   }
   ```

6. **Frontend Update**
   ```
   - Update local state
   - Refresh squad info
   - Show success message
   - Close modal
   ```

---

## 📊 DATABASE CHANGES

### Firebase Updates

**team_seasons** collection:
```javascript
{
  football_purchased_slots: 1,  // Incremented
  football_total_slots: 26,     // Recalculated
  football_budget: 1795,         // Deducted
  football_spent: 215,           // Incremented
  updated_at: ServerTimestamp
}
```

**transactions** collection:
```javascript
{
  team_id: 'SSPSLT0001',
  season_id: 'SSPSLS17',
  type: 'slot_purchase',
  amount: -10,
  balance_after: 1795,
  description: 'Purchased 1 additional squad slot(s)',
  currency_type: 'football',
  created_at: ServerTimestamp,
  metadata: {
    slots_purchased: 1,
    price_per_slot: 10,
    total_cost: 10,
    new_purchased_slots: 1,
    new_total_slots: 26
  }
}
```

### Neon Updates

**teams** table:
```sql
UPDATE teams SET
  football_purchased_slots = 1,
  football_total_slots = 26,
  football_budget = football_budget - 10,
  football_spent = football_spent + 10,
  updated_at = NOW()
WHERE id = 'SSPSLT0001' AND season_id = 'SSPSLS17'
```

**football_slot_purchases** table:
```sql
INSERT INTO football_slot_purchases (
  team_id, season_id, slots_purchased,
  price_per_slot, total_cost, purchased_by, notes
) VALUES (
  'SSPSLT0001', 'SSPSLS17', 1,
  10, 10, 'SSPSLT0001', 'Team purchased 1 slot(s)'
)
```

---

## 🧪 TESTING SCENARIOS

### Scenario 1: Successful Purchase
- Team has £1805 balance
- Team has 0 purchased slots (max 3)
- Click +Buy → Confirm → Success
- **Expected**: Slot added, balance deducted, transaction created

### Scenario 2: Insufficient Balance
- Team has £5 balance
- Slot price is £10
- Click +Buy → Confirm
- **Expected**: Error "Insufficient balance. Required: £10, Available: £5"

### Scenario 3: Max Limit Reached
- Team has 3 purchased slots (max 3)
- +Buy button hidden
- **Expected**: Button not visible, cannot purchase more

### Scenario 4: At Max Limit
- Team has 2 purchased slots (max 3)
- Click +Buy → Confirm → Success
- +Buy button now hidden
- **Expected**: 3rd slot purchased, button disappears

### Scenario 5: Multiple Purchases
- Team purchases 1 slot → Success
- Team purchases 1 slot → Success
- Team purchases 1 slot → Success
- Team tries to purchase 1 slot → Error
- **Expected**: First 3 succeed, 4th fails with max limit error

---

## 🔍 VALIDATION CHECKS

### Frontend Validation
1. ✅ Check if purchased < maxPurchasable before showing button
2. ✅ Check balance before allowing purchase
3. ✅ Disable purchase button if insufficient balance
4. ✅ Show clear warning messages

### Backend Validation
1. ✅ Verify team authentication
2. ✅ Validate slots_to_add > 0
3. ✅ Check purchased + slots_to_add <= maxPurchasable
4. ✅ Verify sufficient balance
5. ✅ Validate season exists
6. ✅ Validate team_season exists

---

## 📝 CONFIGURATION

### Season Settings (Firebase)
```javascript
{
  football_base_slots: 25,           // Base slots for all teams
  football_max_purchasable_slots: 3, // Max additional slots
  football_slot_price: 10            // Price per slot
}
```

### Default Values
- Base slots: 25
- Max purchasable: 3
- Slot price: £10

---

## 🎉 BENEFITS

### For Teams
- ✅ Self-service slot management
- ✅ Immediate availability during bidding
- ✅ Clear pricing and limits
- ✅ Transaction transparency
- ✅ No admin intervention needed

### For Admins
- ✅ Reduced manual work
- ✅ Automatic transaction logging
- ✅ Full audit trail
- ✅ Can still override if needed
- ✅ Configurable pricing and limits

### For System
- ✅ Consistent data across Firebase and Neon
- ✅ Proper validation and error handling
- ✅ Transaction history for auditing
- ✅ Scalable and maintainable

---

## 🚀 DEPLOYMENT NOTES

### Prerequisites
- `football_slot_purchases` table exists in Neon
- Season settings configured in Firebase
- Teams have `football_total_slots` and `football_purchased_slots` fields

### Migration
- Existing teams will have 0 purchased slots
- Existing slots counted as base slots
- No data migration needed

### Rollback
- Remove API route: `app/api/team/manage-slots/route.ts`
- Revert page changes: `app/dashboard/team/bulk-round/[id]/page.tsx`
- Revert API changes: `app/api/team/bulk-rounds/[id]/route.ts`

---

## ✅ COMPLETION CHECKLIST

- [x] Create team slot purchase API route
- [x] Add slot purchase modal to team bulk round page
- [x] Update bulk round API to include slot settings
- [x] Add +Buy button to squad info card
- [x] Implement purchase confirmation flow
- [x] Add warning messages about permanence
- [x] Validate balance and limits
- [x] Update Firebase team_season
- [x] Create Firebase transaction
- [x] Update Neon teams table
- [x] Insert into football_slot_purchases
- [x] Handle errors gracefully
- [x] Test all validation scenarios
- [x] Verify TypeScript compilation
- [x] Document feature completely

---

## 🎯 CONCLUSION

The team slot purchase feature is fully implemented and ready for production. Teams can now purchase additional squad slots directly from the bulk round page with proper validation, transaction logging, and clear warnings about the permanent nature of purchases.

**Status**: READY FOR PRODUCTION ✅
