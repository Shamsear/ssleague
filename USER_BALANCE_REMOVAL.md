# User Balance Field Removal

## Overview
This document describes the removal of the deprecated `balance` field from team user documents in the `users` collection. Budget management is now exclusively handled per season in the `team_seasons` collection.

## Problem
The team user schema previously included a `balance` field that was:
- Redundant with the per-season budget in `team_seasons`
- Not season-specific, making it confusing for multi-season management
- Inconsistent with the actual source of truth (team_seasons)

## Solution
Removed the `balance` field from:
1. Team user creation logic
2. TypeScript type definitions
3. Existing team user documents in Firestore

## Changes Made

### 1. Code Changes

#### `/lib/firebase/auth.ts` (Line 78-84)
**Before:**
```typescript
case 'team':
  userData.teamName = additionalData?.teamName || '';
  userData.teamLogo = additionalData?.teamLogo || '';
  userData.balance = additionalData?.balance || 0;  // ❌ REMOVED
  userData.players = additionalData?.players || [];
  userData.committeeId = additionalData?.committeeId || '';
  break;
```

**After:**
```typescript
case 'team':
  userData.teamName = additionalData?.teamName || '';
  userData.teamLogo = additionalData?.teamLogo || '';
  userData.players = additionalData?.players || [];
  userData.committeeId = additionalData?.committeeId || '';
  break;
```

#### `/components/auth/Register.tsx` (Line 88-92)
**Before:**
```typescript
: {
    teamName,
    balance: 100000,  // ❌ REMOVED
    players: [],
  };
```

**After:**
```typescript
: {
    teamName,
    players: [],
  };
```

#### `/types/user.ts` (Line 33-40)
**Before:**
```typescript
export interface Team extends BaseUser {
  role: 'team';
  teamName: string;
  teamLogo?: string;
  balance: number;  // ❌ REMOVED
  players: string[];
  committeeId?: string;
}
```

**After:**
```typescript
export interface Team extends BaseUser {
  role: 'team';
  teamName: string;
  teamLogo?: string;
  players: string[];
  committeeId?: string;
}
```

### 2. Migration Scripts

#### `scripts/remove-user-balance.js`
Migration script to remove the balance field from existing team user documents.

**Usage:**
```bash
node scripts/remove-user-balance.js
```

**Features:**
- Queries all team users (role='team')
- Removes the `balance` field using `FieldValue.delete()`
- Updates the `updated_at` timestamp
- Provides detailed logging and summary

#### `scripts/verify-user-balance-removal.js`
Verification script to confirm balance field removal.

**Usage:**
```bash
node scripts/verify-user-balance-removal.js
```

**Features:**
- Checks all team users for the balance field
- Reports pass/fail status for each user
- Provides summary statistics

## Migration Execution

**Date:** 2025-10-05  
**Script:** `scripts/remove-user-balance.js`

**Results:**
```
✅ Successfully updated: 2 documents
⏭️  Skipped: 0 documents
❌ Errors: 0
📝 Total processed: 2 team users
```

**Documents Updated:**
1. **shamsear** (`6Ys0fx9apuNrnW98N2DdUeos2eu2`)
   - Previous balance: 15000
   - Status: Balance field removed ✅

2. **fayis** (`PYveBNeFS3gNMp6KmP4FhFAfeCw1`)
   - Previous balance: 100000
   - Status: Balance field removed ✅

## Verification

**Verification Run:** 2025-10-05  
**Script:** `scripts/verify-user-balance-removal.js`

**Results:**
```
✅ Correct (no balance): 2
❌ Incorrect (has balance): 0
📝 Total: 2
```

All team users verified successfully - no balance field present. ✅

## Impact

### For New Team Registrations
- Teams will no longer have a balance field in their user document
- Budget is assigned only when joining a season (in team_seasons collection)

### For Existing Teams
- The balance field has been removed from all existing team user documents
- Per-season budgets remain intact in the team_seasons collection
- No functionality is lost - all budget data is preserved per season

### Where Budget is Managed Now

**Source of Truth:** `team_seasons` collection

**Document ID:** `{userId}_{seasonId}`

**Budget Fields:**
```typescript
{
  budget: number,              // Current available budget
  starting_balance: number,    // Initial budget for the season
  total_spent: number,         // Total amount spent
  players_count: number,       // Number of players acquired
  // ... other fields
}
```

**Budget Updates:**
- Initialize when team joins a season
- Decrease when winning a player in auction
- Track via `budget`, `total_spent`, and `players_count`

## Related Files

### Modified
- ✅ `/lib/firebase/auth.ts` - Removed balance from user creation
- ✅ `/components/auth/Register.tsx` - Removed balance from registration
- ✅ `/types/user.ts` - Removed balance from Team interface

### Created
- ✅ `/scripts/remove-user-balance.js` - Migration script
- ✅ `/scripts/verify-user-balance-removal.js` - Verification script
- ✅ `/USER_BALANCE_REMOVAL.md` - This documentation

### Unaffected (Correct Behavior)
- `/app/api/seasons/[seasonId]/register/route.ts` - Budget managed here per season ✅
- `/app/register/team/page.tsx` - Budget assigned during season registration ✅
- `/lib/finalize-round.ts` - Updates team_seasons budget, not user balance ✅
- `/app/api/team/dashboard/route.ts` - Reads budget from team_seasons ✅

## Testing Checklist

- [x] Removed balance from team user creation code
- [x] Removed balance from TypeScript type definitions
- [x] Created migration script to remove balance from existing users
- [x] Ran migration script successfully (2 users updated)
- [x] Verified all team users have balance field removed
- [x] Confirmed budget is still managed correctly in team_seasons
- [ ] Test new team registration (should not create balance field)
- [ ] Test season registration (should create budget in team_seasons)
- [ ] Test round finalization (should update team_seasons budget)
- [ ] Test team dashboard (should display budget from team_seasons)

## Best Practices

### For Developers
1. **Never use `user.balance`** - It no longer exists
2. **Always use `teamSeasonData.budget`** - From team_seasons collection
3. **Query pattern:**
   ```typescript
   const teamSeasonId = `${userId}_${seasonId}`;
   const teamSeasonDoc = await getDoc(doc(db, 'team_seasons', teamSeasonId));
   const budget = teamSeasonDoc.data()?.budget;
   ```

### For Budget Operations
1. **Initialize budget:** When team joins a season
2. **Update budget:** When team acquires or releases players
3. **Query budget:** From team_seasons, never from users

## Future Considerations

### Type Safety
- The Team interface no longer includes balance
- TypeScript will catch any attempts to use `user.balance`
- This provides compile-time safety against using the deprecated field

### Data Consistency
- All budget data is now centralized in team_seasons
- Single source of truth per team per season
- No risk of balance/budget mismatch

### Multi-Season Support
- Each season has its own independent budget
- Teams can participate in multiple seasons with different budgets
- Historical budget data is preserved per season

## Rollback (If Needed)

If you need to rollback this change:

1. Restore the balance field in code:
   ```typescript
   // In lib/firebase/auth.ts
   userData.balance = additionalData?.balance || 0;
   ```

2. Restore the Team interface:
   ```typescript
   // In types/user.ts
   balance: number;
   ```

3. Re-add balance to existing users:
   ```javascript
   // Migration script
   await doc.ref.update({
     balance: 15000, // or appropriate value
     updated_at: admin.firestore.FieldValue.serverTimestamp(),
   });
   ```

However, this is **not recommended** as it reintroduces the redundancy and confusion.

## Date
2025-10-05

## Status
✅ **COMPLETED** - All changes applied, existing data migrated, and verified
