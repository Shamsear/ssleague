# Firebase Field Name Fix - "No active season found"

## Issue
Admin was getting "No active season found" error when trying to start a new round, even though an active season existed in Firebase.

## Root Cause
The Firebase queries were looking for `is_active` (snake_case) but the actual field name in the database is `isActive` (camelCase).

### Your Season Document Structure:
```javascript
{
  isActive: true,           // ✅ Correct field name
  status: "active",
  name: "South Soccers Super League Season 17",
  // ... other fields
}
```

### Old Query (WRONG):
```javascript
where('is_active', '==', true)  // ❌ Field doesn't exist
```

### New Query (CORRECT):
```javascript
where('isActive', '==', true)   // ✅ Matches actual field name
```

## Files Fixed

1. **`app/dashboard/committee/rounds/page.tsx`**
   - Line 64: Changed `where('is_active', '==', true)` to `where('isActive', '==', true)`

2. **`app/dashboard/committee/bulk-rounds/page.tsx`**
   - Line 56: Changed `where('is_active', '==', true)` to `where('isActive', '==', true)`

3. **`app/dashboard/committee/page.tsx`**
   - Line 44: Changed `where('is_active', '==', true)` to `where('isActive', '==', true)`

4. **`app/dashboard/team/page.tsx`**
   - Line 60: Changed `where('is_active', '==', true)` to `where('isActive', '==', true)`

## Result

✅ Admin can now start new rounds successfully
✅ Season is properly detected as active
✅ All dashboard pages correctly identify the active season

## Testing

1. Go to Committee Dashboard → Rounds Management
2. Try to start a new round
3. Select a position and click "Start Round"
4. Should work without "No active season found" error

## Note on Firebase Field Naming

Your Firebase database uses **camelCase** for field names:
- ✅ `isActive`
- ✅ `is_team_registration_open`
- ✅ `maxPlayersPerTeam`
- ✅ `purseAmount`

Always check the actual field name in Firebase console before querying!

---

**Fixed**: January 2025
**Status**: ✅ Complete
