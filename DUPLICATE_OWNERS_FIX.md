# Duplicate Owners Issue - Root Cause & Fix

## Problem
Multiple owner records were being created for the same Firebase user (registered_user_id) with different team IDs.

### Example from Database:
```
id=5: SSPSO0005, team_id=691756945c7cd75eb83055b7, firebase_uid=2Nzm6mnAvUZzlR4hM1b3EX9jqUM2
id=6: SSPSO0006, team_id=6917574f5c7cd75eb834c8e0, firebase_uid=2Nzm6mnAvUZzlR4hM1b3EX9jqUM2
```

## Root Cause

There were **three different code paths** creating owner records:

1. **`/api/owners` (POST)** - During team registration
2. **`/api/team/profile/update`** - When editing team profile  
3. **Dashboard flows** - Various dashboard operations

Each path was only checking if an owner existed for a specific `team_id`, but NOT checking if the Firebase user (`registered_user_id`) already had an owner record for a different team.

### Why This Happened:
- User registers a team → Creates owner record #1 with team_id A
- Same user somehow gets another team record → Creates owner record #2 with team_id B
- Both checks passed because they only looked at `team_id`, not `registered_user_id`

## Solution Implemented

### 1. Code Changes

**Updated `/api/owners/route.ts`:**
```typescript
// Now checks BOTH team_id AND registered_user_id
const existingOwner = await sql`
  SELECT owner_id, team_id FROM owners
  WHERE team_id = ${teamId} 
     OR (registered_user_id = ${registeredUserId} AND registered_user_id IS NOT NULL)
  LIMIT 1
`;
```

**Updated `/api/team/profile/update/route.ts`:**
```typescript
// Same check added here
const existingOwner = await tournamentSql`
  SELECT id, team_id FROM owners 
  WHERE team_id = ${teamId} 
     OR (registered_user_id = ${userId} AND registered_user_id IS NOT NULL)
  LIMIT 1
`;
```

### 2. Database Migration

Run the migration in `database/migrations/fix-duplicate-owners.sql` to:

1. **Identify duplicates** - Shows all Firebase users with multiple owner records
2. **Clean up duplicates** - Keeps only the latest owner record per user
3. **Add unique constraint** - Prevents future duplicates with a unique index
4. **Verify cleanup** - Confirms no duplicates remain

### 3. How to Run the Migration

```bash
# Connect to your database
psql -h your-host -U your-user -d your-database

# Run the migration
\i database/migrations/fix-duplicate-owners.sql
```

Or run each step manually and review the results before proceeding.

## Prevention

The unique index ensures:
- Each Firebase user (`registered_user_id`) can only have ONE owner record
- NULL values are still allowed (for cases where user ID isn't set)
- Any attempt to create a duplicate will fail with a constraint violation

## Testing

After applying the fix:

1. Try registering a new team → Should create 1 owner record
2. Try editing the profile → Should update existing owner, not create new
3. Try registering the same Firebase user again → Should fail with proper error

## Additional Investigation Needed

You should also check why multiple team records are being created for the same user. Look for:
- Team registration flow
- Dashboard initialization
- Profile creation/update logic

Each user should only have ONE active team per season.
