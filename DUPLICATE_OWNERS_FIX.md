# Duplicate Owners Issue - Fixed

## Problem
Team owners were being created twice in the database:
1. Once with proper `owner_id` format (`SSPSO0001`, `SSPSO0002`, etc.) via `/api/owners`
2. Once with Firebase UID as `owner_id` via `/api/team/profile/update`

### Example Duplicates
```
ID  owner_id                              team_id                           name
1   SSPSO0001                             POOEoZr5lvZoeiQeA492LafRG9R2      Karthik Mohan
2   SSPSO0002                             SSPSLT0006                        KARTHIK MOHAN  ✓ CORRECT

3   SSPSO0003                             RPzKTwBGFUYplM9G8E37Xy1isiq1      Kiran Asokan
4   SSPSO0004                             SSPSLT0026                        KIRAN ASOKAN   ✓ CORRECT
```

## Root Cause
**File:** `app/api/team/profile/update/route.ts`  
**Lines:** 129, 237

The team profile update endpoint was:
- Using Firebase `userId` (UID) directly as `owner_id` instead of generating proper IDs
- Same issue existed for `manager_id` generation

## Fix Applied

### 1. Updated `/app/api/team/profile/update/route.ts`

#### Added Import
```typescript
import { formatId, ID_PREFIXES, ID_PADDING } from '@/lib/id-utils';
```

#### Fixed Owner Creation (lines 110-173)
**Before:**
```typescript
owner_id,
...
) VALUES (
  ${userId},  // ❌ Firebase UID
  ${teamId},
```

**After:**
```typescript
// Generate proper owner ID
const latestOwner = await tournamentSql`
  SELECT owner_id FROM owners ORDER BY id DESC LIMIT 1
`;

let nextCounter = 1;
if (latestOwner.length > 0) {
  const lastId = latestOwner[0].owner_id;
  const numericPart = lastId.replace(/\D/g, '');
  if (numericPart) {
    const lastCounter = parseInt(numericPart, 10);
    if (!isNaN(lastCounter)) {
      nextCounter = lastCounter + 1;
    }
  }
}

const ownerId = formatId(ID_PREFIXES.OWNER, nextCounter, ID_PADDING.OWNER);

// Insert with proper ID
owner_id,
...
registered_user_id,  // Added this field
created_by,          // Added this field
...
) VALUES (
  ${ownerId},          // ✓ Proper SSPSO#### format
  ${teamId},
  ...
  ${userId},           // Stored in registered_user_id
  ${userId},           // Stored in created_by
```

#### Fixed Manager Creation (lines 217-275)
Applied the same pattern:
- Generate proper `SSPSM####` format ID
- Added `created_by` field
- Removed Firebase UID usage in `manager_id`

### 2. Created Cleanup Script

**File:** `scripts/cleanup-duplicate-owners.sql`

This script:
1. **Identifies** duplicates (same email, name, phone)
2. **Keeps** the entry with proper team_id format (`SSPSLT%`)
3. **Removes** the entry with Firebase UID
4. Provides verification query

## How to Clean Up Existing Duplicates

### Step 1: Identify Duplicates
Run the first query in `scripts/cleanup-duplicate-owners.sql` to see what will be affected.

### Step 2: Delete Duplicates
Uncomment the DELETE statement in the script and run it to remove duplicates.

### Step 3: Verify
Run the verification query to confirm cleanup.

## Prevention
With the fix applied:
- ✅ All new owners will use proper `SSPSO####` format
- ✅ All new managers will use proper `SSPSM####` format
- ✅ Firebase UIDs are stored in `registered_user_id` field
- ✅ No more duplicates will be created

## Impact
- **Before:** 2 entries per owner (duplicate)
- **After:** 1 entry per owner (correct)
- **Fields Fixed:**
  - `owner_id` - now always proper format
  - `manager_id` - now always proper format
  - `registered_user_id` - stores Firebase UID for reference
  - `created_by` - stores who created the record
