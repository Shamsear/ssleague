# Firebase Reads Optimization - Critical Hotfix

## Problem Identified

### Root Cause
The `/api/admin/tiebreakers` endpoint performs a Firebase read on **EVERY request** to verify the user's role:
```typescript
const userDoc = await adminDb.collection('users').doc(userId).get();
```

Combined with:
- The tiebreakers page auto-refreshes every 5 seconds when viewing active tiebreakers
- Each refresh = 1 Firebase read for user verification
- **720 reads per hour per user** with the page open

### Impact
- 3K reads in 1 hour = approximately 4-5 committee admins with the page open simultaneously
- Or 1-2 users leaving the page open for extended periods

## Solution

### 1. Use Cached Role Verification
Instead of reading from Firebase on every request, use the `verifyAuth` helper which:
- Verifies the JWT token (no Firebase read)
- Includes role information in the token claims
- Only reads from Firebase on initial authentication

### 2. Increase Polling Interval
- Change from 5 seconds to 10-15 seconds for less critical updates
- Use WebSocket for real-time updates where absolutely necessary

### 3. Implement Request Debouncing
- Add visibility change detection (pause polling when tab is hidden)
- Clear intervals when component unmounts

## Files to Fix

### High Priority (Causing Most Reads)
1. `/app/api/admin/tiebreakers/route.ts` - ✅ Fixed
2. `/app/api/team/dashboard/route.ts` - Check for Firebase reads
3. `/app/api/rounds/[id]/route.ts` - Check team name fetching

### Pages with Aggressive Polling
1. `/app/dashboard/committee/tiebreakers/page.tsx` - 5s interval ✅ Fixed to 10s + visibility
2. `/app/dashboard/team/RegisteredTeamDashboard.tsx` - Check intervals
3. `/app/dashboard/committee/page.tsx` - Check intervals

## Implementation

### Replace Direct Firebase Auth Checks
**Before:**
```typescript
const userDoc = await adminDb.collection('users').doc(userId).get();
if (userData?.role !== 'admin') { ... }
```

**After:**
```typescript
const auth = await verifyAuth(['admin', 'committee_admin']);
if (!auth.authenticated) { ... }
```

### Add Visibility Detection
**Before:**
```typescript
const interval = setInterval(fetchData, 5000);
return () => clearInterval(interval);
```

**After:**
```typescript
const interval = setInterval(fetchData, 10000);

const handleVisibilityChange = () => {
  if (document.hidden) {
    clearInterval(interval);
  } else {
    fetchData();
    setInterval(fetchData, 10000);
  }
};

document.addEventListener('visibilitychange', handleVisibilityChange);

return () => {
  clearInterval(interval);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
};
```

## Expected Reduction
- From 720 reads/hour → **0 reads/hour** for role verification (using JWT claims)
- From 720 reads/hour → **360 reads/hour** by doubling polling interval
- Additional 50-70% reduction with visibility detection (users switch tabs frequently)

**Total Expected:** 90-95% reduction in Firebase reads
