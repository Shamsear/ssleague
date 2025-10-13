# Token Expiration Auto-Refresh Fix

## Problem

Firebase ID tokens expire after 1 hour. When a user's token expires, API calls return 401 Unauthorized errors with the message:

```
Firebase ID token has expired. Get a fresh ID token from your client app and try again
```

This was happening on the team dashboard causing errors like:
```
GET /api/team/dashboard?season_id=xxx 401 in 1003ms
```

## Root Cause

The team dashboard was using regular `fetch()` calls which don't automatically handle token expiration. Even though the application has:
1. Automatic token refresh every 50 minutes (in `AuthContext.tsx`)
2. A `fetchWithTokenRefresh()` utility function (in `lib/token-refresh.ts`)

The dashboard wasn't using the `fetchWithTokenRefresh()` wrapper.

## Solution

Updated the team dashboard to use `fetchWithTokenRefresh()` instead of regular `fetch()`.

### Files Modified

**`app/dashboard/team/RegisteredTeamDashboard.tsx`**

#### Changes Made:

1. **Import the token refresh utility:**
```typescript
// Added import
import { fetchWithTokenRefresh } from '@/lib/token-refresh';
```

2. **Replace fetch with fetchWithTokenRefresh:**
```typescript
// OLD:
const response = await fetch(`/api/team/dashboard?${params}`, {
  headers: { 'Cache-Control': 'no-cache' },
});

// NEW:
const response = await fetchWithTokenRefresh(`/api/team/dashboard?${params}`, {
  headers: { 'Cache-Control': 'no-cache' },
});
```

## How It Works

The `fetchWithTokenRefresh()` function:

1. **Makes the initial request** using regular fetch
2. **Checks for 401 responses** (token expired)
3. **Auto-refreshes the token** by calling `currentUser.getIdToken(true)`
4. **Updates the cookie** via `/api/auth/set-token`
5. **Retries the request** automatically with the new token
6. **Returns the response** transparently

### Code Flow:

```
User Dashboard Request
   ↓
fetchWithTokenRefresh()
   ↓
Try: fetch(/api/team/dashboard)
   ↓
If 401 (token expired):
   ↓
   1. Get fresh token: auth.currentUser.getIdToken(true)
   ↓
   2. Update cookie: POST /api/auth/set-token
   ↓
   3. Retry: fetch(/api/team/dashboard)
   ↓
Return response ✅
```

## Additional Protection

The application already has multiple layers of token management:

### 1. Automatic Token Refresh (AuthContext)
Located in: `contexts/AuthContext.tsx`

```typescript
// Refreshes token every 50 minutes (before 1-hour expiration)
useEffect(() => {
  if (firebaseUser) {
    const cleanup = setupTokenRefreshInterval();
    return cleanup;
  }
}, [firebaseUser]);
```

### 2. On-Demand Token Refresh (fetchWithTokenRefresh)
Located in: `lib/token-refresh.ts`

```typescript
// Automatically retries requests after refreshing expired tokens
export async function fetchWithTokenRefresh(url: string, options?: RequestInit)
```

### 3. Manual Token Refresh (refreshAuthToken)
Located in: `lib/token-refresh.ts`

```typescript
// Can be called manually when needed
export async function refreshAuthToken(): Promise<string | null>
```

## Impact

✅ **No more 401 errors** on team dashboard after 1 hour
✅ **Seamless user experience** - automatic retry
✅ **No manual refresh needed** - handles token expiration transparently
✅ **Consistent** - can apply same pattern to other components

## Applying to Other Components

If you see similar 401 errors in other parts of the application, apply the same fix:

1. Import the utility:
```typescript
import { fetchWithTokenRefresh } from '@/lib/token-refresh';
```

2. Replace fetch calls:
```typescript
// Change this:
await fetch('/api/endpoint')

// To this:
await fetchWithTokenRefresh('/api/endpoint')
```

## Testing

To verify the fix works:

1. **Login to the application**
2. **Stay on the team dashboard for over 1 hour** (token expires)
3. **Observe the network tab** - should see:
   - First request: 401 (token expired)
   - Token refresh: POST /api/auth/set-token
   - Retry request: 200 (success)
4. **Dashboard continues to work** without errors

## Related Files

### Modified ✅
- `app/dashboard/team/RegisteredTeamDashboard.tsx` - Now uses fetchWithTokenRefresh

### Already Working ✅
- `contexts/AuthContext.tsx` - Automatic 50-minute refresh
- `lib/token-refresh.ts` - Token refresh utilities
- `app/api/auth/set-token/route.ts` - Updates token cookie
- `app/api/auth/clear-token/route.ts` - Clears token on logout

## Best Practices

1. **Use fetchWithTokenRefresh for authenticated API calls** in client components
2. **Keep the 50-minute auto-refresh** - prevents most expirations
3. **Handle 401 gracefully** - the wrapper does this automatically
4. **Log token refreshes** - helps debug auth issues

## Date
2025-10-05

## Status
✅ **COMPLETED** - Team dashboard now handles token expiration automatically
