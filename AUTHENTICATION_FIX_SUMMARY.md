# Team Dashboard Authentication Fix

## Problem
Team dashboard was returning **401 Unauthorized** error and active rounds were not displaying.

## Root Cause
**Authentication Mismatch**: The team dashboard API was using a different authentication method than other team APIs:

- ❌ **Dashboard API** (`/api/team/dashboard`): Was looking for Firebase `session` cookie
- ✅ **Other Team APIs** (`/api/team/round/[id]`, `/api/team/bids`, etc.): Use JWT `token` cookie

When teams log in, they get a JWT token stored in the `token` cookie, NOT a Firebase session cookie.

## Solution
Updated `/app/api/team/dashboard/route.ts` to use the same JWT authentication as other team APIs:

### Changes Made:
1. Added `import jwt from 'jsonwebtoken'`
2. Changed from Firebase session verification to JWT token verification
3. Now checks for `token` cookie instead of `session` cookie
4. Verifies JWT and checks if role is `team`

### Before:
```typescript
const session = cookieStore.get('session')?.value;
const decodedClaims = await adminAuth.verifySessionCookie(session, true);
const userId = decodedClaims.uid;
```

### After:
```typescript
const token = cookieStore.get('token')?.value;
const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
if (decoded.role !== 'team') { /* reject */ }
const userId = decoded.userId;
```

## Testing
Run the test script to verify the data is available:
```bash
node test-dashboard-api.js
```

Expected output: Should show 1 active round for CB position with 91 minutes remaining.

## Next Steps
1. Restart dev server: `npm run dev`
2. Hard refresh browser (Ctrl+Shift+R)
3. Team dashboard should now display the active round with "Join Round" button

## Files Modified
- ✅ `/app/api/team/dashboard/route.ts` - Fixed authentication method
- ✅ `/lib/auth-helper.ts` - Fixed async cookies()
- ✅ `/app/dashboard/committee/rounds/page.tsx` - Fixed timer types
- ✅ `/app/dashboard/team/RegisteredTeamDashboard.tsx` - Fixed Round interface
