# Authentication Modes

## Overview
The app supports two authentication modes to balance security and performance.

## Full Verification (Default)
**Use for:** Sensitive operations that modify data or access private information

### When to use:
- ✅ Placing/canceling bids
- ✅ Admin actions (creating rounds, finalizing, etc.)
- ✅ Wallet/payment operations
- ✅ Submitting tiebreaker bids
- ✅ Updating user profiles
- ✅ Team registration/settings

### How it works:
1. Checks in-memory cache (5-minute TTL)
2. If cache miss, verifies token with Firebase
3. Caches the result

```typescript
// Example usage
const auth = await verifyAuth(['team'], request);
// or for admin
const auth = await verifyAuth(['admin', 'committee_admin'], request);
```

**Firebase reads:** 1 read per 5 minutes per unique token

---

## Lightweight Mode
**Use for:** Read-only operations with low security risk

### When to use:
- ✅ Browsing player lists
- ✅ Viewing public statistics
- ✅ Checking round status (non-sensitive)
- ✅ Starred player operations
- ✅ Reading team leaderboards

### How it works:
1. Decodes JWT token locally (no Firebase call)
2. Extracts user ID and role from token payload
3. No signature verification

```typescript
// Example usage
const auth = await verifyAuth(['team'], request, true); // true = lightweight
```

**Firebase reads:** 0 reads

---

## Security Trade-offs

### Lightweight Mode Risks
- ❌ **No signature verification** - Token could be tampered with
- ❌ **No revocation check** - Revoked tokens still work
- ❌ **No expiration validation** - Expired tokens might work

### Why it's acceptable for some operations:
1. **Starred players:** Worst case - someone stars players they shouldn't. No financial impact.
2. **Player browsing:** Just shows which players are starred. No sensitive data exposed.
3. **Public stats:** Data is already public, not sensitive.

### Why NOT to use for sensitive ops:
1. **Bids:** Money involved - must verify token is valid
2. **Admin actions:** High privilege - must verify role is legitimate
3. **Profile updates:** Personal data - must verify user identity

---

## Implementation Examples

### Read-only endpoint (lightweight)
```typescript
export async function GET(request: NextRequest) {
  // Use lightweight mode - just decode token
  const auth = await verifyAuth(undefined, request, true);
  
  if (!auth.authenticated) {
    // Optional: continue without auth, just show limited data
    return showPublicData();
  }
  
  // Show personalized data
  return showUserSpecificData(auth.userId);
}
```

### Write endpoint (full verification)
```typescript
export async function POST(request: NextRequest) {
  // Full verification required - checks signature, expiration, revocation
  const auth = await verifyAuth(['team'], request);
  
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Perform sensitive operation
  await placeBid(auth.userId, bidData);
}
```

---

## Performance Impact

### Before optimizations:
- Every API call = 1 Firebase read
- 10 API calls in 1 minute = 10 Firebase reads

### After full verification with caching:
- First API call = 1 Firebase read
- Next 9 calls (within 5 min) = 0 Firebase reads
- **Total: 1 read** (90% reduction)

### With lightweight mode:
- All API calls = 0 Firebase reads
- **Total: 0 reads** (100% reduction)

---

## Recommendations

### Use lightweight mode for:
- Player database/listing endpoints
- Starred player endpoints
- Public leaderboards
- Round listings (non-sensitive)
- Statistics/analytics views

### Always use full verification for:
- Any endpoint that writes data
- Any endpoint with role checks (admin/committee)
- Any endpoint involving money/bids
- Any endpoint with private user data
- Any endpoint that can affect other users

---

## Monitoring

To check if lightweight mode is being misused:
1. Monitor error logs for "Invalid token format" errors
2. Check if any unauthorized actions are occurring
3. Review Firebase console for unexpected activity

If you see issues, switch back to full verification for that endpoint.
