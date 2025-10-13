# Token Expiration Fix

## Issue Description

**Error**: `Firebase ID token has expired. Get a fresh ID token from your client app and try again (auth/id-token-expired)`

**Location**: Various API routes (e.g., `app/api/admin/rounds/[id]/finalize/route.ts`)

**Cause**: Firebase ID tokens expire after 1 hour. When users stay on the page longer than an hour, their token becomes invalid and API requests fail with 401 errors.

## Understanding Firebase Token Expiration

Firebase ID tokens are JSON Web Tokens (JWT) that:
- Are issued when a user signs in
- **Expire after 1 hour**
- Must be refreshed to maintain authenticated sessions
- Are automatically verified on the server side

When a token expires:
1. Client makes an API request with expired token
2. Server tries to verify the token using `adminAuth.verifyIdToken()`
3. Verification fails with `auth/id-token-expired` error
4. API returns 401 Unauthorized

## Solution Implemented

### 1. Automatic Token Refresh (Proactive)

**File**: `lib/token-refresh.ts`

The system now automatically refreshes tokens **every 50 minutes**, preventing expiration:

```typescript
export function setupTokenRefreshInterval(): () => void {
  const REFRESH_INTERVAL = 50 * 60 * 1000; // 50 minutes
  
  const intervalId = setInterval(async () => {
    const token = await refreshAuthToken();
    // Token is refreshed in the background
  }, REFRESH_INTERVAL);
  
  return () => clearInterval(intervalId);
}
```

**Integration**: Added to `AuthContext` to start automatically when user logs in.

### 2. Manual Token Refresh (On-Demand)

**Function**: `refreshAuthToken()`

Users can manually refresh their token:

```typescript
export async function refreshAuthToken(): Promise<string | null> {
  const currentUser = auth.currentUser;
  
  // Force token refresh with Firebase
  const idToken = await currentUser.getIdToken(true);
  
  // Update cookie via API
  await fetch('/api/auth/set-token', {
    method: 'POST',
    body: JSON.stringify({ token: idToken }),
  });
  
  return idToken;
}
```

### 3. Fetch Wrapper with Auto-Retry

**Function**: `fetchWithTokenRefresh()`

Automatically retries failed requests after refreshing token:

```typescript
export async function fetchWithTokenRefresh(
  url: string,
  options?: RequestInit
): Promise<Response> {
  let response = await fetch(url, options);

  // If we get a 401, refresh token and retry
  if (response.status === 401) {
    await refreshAuthToken();
    response = await fetch(url, options);
  }

  return response;
}
```

### 4. User-Friendly Error Component

**File**: `components/TokenExpiredNotification.tsx`

Displays when token expires, with a button to refresh:

```tsx
<TokenExpiredNotification 
  onRefresh={() => {
    // Callback after successful refresh
  }} 
/>
```

## Implementation Details

### AuthContext Update

**File**: `contexts/AuthContext.tsx`

Added automatic token refresh:

```typescript
useEffect(() => {
  if (firebaseUser) {
    // Setup automatic refresh every 50 minutes
    const cleanup = setupTokenRefreshInterval();
    return cleanup;
  }
}, [firebaseUser]);
```

### Token Refresh Flow

```
1. User logs in
   ↓
2. Token stored in cookie (valid for 1 hour)
   ↓
3. After 50 minutes → Automatic refresh triggered
   ↓
4. New token fetched from Firebase
   ↓
5. Cookie updated with new token
   ↓
6. Process repeats every 50 minutes
```

### Handling 401 Errors

**Option A: Use the fetch wrapper**
```typescript
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

// Instead of:
// const response = await fetch('/api/endpoint');

// Use:
const response = await fetchWithTokenRefresh('/api/endpoint');
```

**Option B: Manual handling**
```typescript
const response = await fetch('/api/endpoint');

if (response.status === 401) {
  await refreshAuthToken();
  // Retry the request or show notification
}
```

## Usage Examples

### For API Calls

```typescript
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

// Automatically handles token refresh on 401
const handleFinalize = async () => {
  const response = await fetchWithTokenRefresh(`/api/admin/rounds/${id}/finalize`, {
    method: 'POST',
  });
  
  const result = await response.json();
  // Handle result
};
```

### For Components

```typescript
import TokenExpiredNotification from '@/components/TokenExpiredNotification';
import { useState } from 'react';

export default function MyComponent() {
  const [tokenExpired, setTokenExpired] = useState(false);

  const handleApiCall = async () => {
    const response = await fetch('/api/endpoint');
    
    if (response.status === 401) {
      setTokenExpired(true);
      return;
    }
    
    // Handle success
  };

  return (
    <>
      {tokenExpired && (
        <TokenExpiredNotification 
          onRefresh={() => {
            setTokenExpired(false);
            handleApiCall(); // Retry
          }} 
        />
      )}
      {/* Rest of component */}
    </>
  );
}
```

## Testing

### Test Automatic Refresh
1. Log in to the application
2. Check browser console logs
3. Wait 50 minutes
4. Should see: `✅ Automatic token refresh completed`

### Test Manual Refresh
1. Wait for token to expire (1 hour)
2. Try to perform an action (e.g., finalize round)
3. Should see 401 error
4. Call `refreshAuthToken()` or use the notification component
5. Action should succeed after refresh

### Test Fetch Wrapper
```typescript
// This should handle expiration automatically
const response = await fetchWithTokenRefresh('/api/endpoint');
```

## Prevention Measures

### 1. Automatic Background Refresh
✅ Tokens refresh every 50 minutes (before 1-hour expiration)

### 2. User Notifications
✅ Clear error messages when token expires
✅ Easy refresh button for users

### 3. Graceful Degradation
✅ Failed API calls can be retried
✅ No data loss on token expiration

### 4. Logging
✅ All token operations are logged for debugging

## Monitoring

### Browser Console Logs

**Successful automatic refresh:**
```
✅ Automatic token refresh completed
```

**401 error with retry:**
```
🔄 Received 401, attempting token refresh...
✅ Token refreshed successfully
✅ Request succeeded after token refresh
```

**Failed refresh:**
```
⚠️ Automatic token refresh failed
Error refreshing auth token: [error details]
```

## Common Issues

### Issue: Token still expires
**Cause**: Automatic refresh not running
**Solution**: Check that user is logged in and `setupTokenRefreshInterval` is called

### Issue: 401 errors persist after refresh
**Cause**: Cookie not being set correctly
**Solution**: Check `/api/auth/set-token` endpoint is working

### Issue: Infinite refresh loop
**Cause**: Refresh failing silently
**Solution**: Check Firebase authentication state and network connectivity

## Best Practices

1. **Use the fetch wrapper** for all API calls that require authentication
2. **Show user notifications** when manual refresh is needed
3. **Log all token operations** for debugging
4. **Test with expired tokens** during development
5. **Monitor refresh success rate** in production

## Related Files

- Token utilities: `lib/token-refresh.ts`
- Auth context: `contexts/AuthContext.tsx`
- Notification component: `components/TokenExpiredNotification.tsx`
- Auth API endpoints: `app/api/auth/set-token/route.ts`

## Resources

- [Firebase Token Verification Docs](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
- [Firebase getIdToken() Docs](https://firebase.google.com/docs/reference/js/auth.user#useridtokenresult)
- [JWT Token Expiration](https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.4)

## Deployment Checklist

- [x] Token refresh utilities created
- [x] AuthContext updated with auto-refresh
- [x] Fetch wrapper implemented
- [x] Notification component created
- [x] Documentation completed
- [ ] Test automatic refresh in production
- [ ] Monitor 401 error rates
- [ ] Add analytics for token refresh events

## Support

If you still encounter token expiration issues:

1. Check browser console for refresh logs
2. Verify Firebase authentication state
3. Check cookie storage (should have `token` cookie)
4. Try manual logout and login
5. Clear browser cookies and cache

**Emergency Fix**: If automatic refresh fails, user can simply refresh the page or log out and back in.
