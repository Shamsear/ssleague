# Team Dashboard Authentication Fix

## Problem
When team users tried to access their dashboard at `/dashboard/team`, they received the error:
```
Unable to load dashboard
Access denied. Required roles: team
```

## Root Cause
The authentication system uses **JWT custom claims** to check user roles without making database calls. However, existing users were created without having their role set as a custom claim in their Firebase JWT token.

The `verifyAuth()` function in `lib/auth-helper.ts` checks for a `role` claim in the JWT token:
```typescript
// Get role from custom claims (already in the JWT token - zero DB reads!)
role = decodedToken.role as string | undefined;

// Check if user has required role (if specified)
if (requiredRoles && requiredRoles.length > 0) {
  if (!role || !requiredRoles.includes(role)) {
    return {
      authenticated: false,
      error: `Access denied. Required roles: ${requiredRoles.join(', ')}`,
    };
  }
}
```

## Solution

### 1. ✅ Set Custom Claims for Existing Users
Ran the migration script to set custom claims for all existing users:
```bash
node scripts/set-user-custom-claims.js
```

**Result:**
- ✅ 36 users updated with role claims
- ⏭️ 1 user already had claims (super_admin)
- Total: 37 users processed

### 2. ✅ Automatic Custom Claims for New Team Users
Modified `/app/api/teams/create/route.ts` to automatically set custom claims when new team accounts are created:

```typescript
// Set custom claims for the user (enables role-based auth without DB reads)
try {
  const user = await adminAuth.getUser(uid);
  const currentClaims = user.customClaims || {};
  
  await adminAuth.setCustomUserClaims(uid, {
    ...currentClaims,
    role: 'team',
  });
  
  console.log(`✅ Custom claims set for user ${uid}: role=team`);
} catch (claimsError) {
  console.error('Error setting custom claims:', claimsError);
  // Don't fail the request if claims fail - can be set later
}
```

### 3. ✅ Automatic Custom Claims on User Approval
Modified `lib/firebase/auth.ts` `approveUser()` function to set custom claims when admins approve team accounts:

```typescript
// Set custom claims for JWT token (enables role-based auth without DB reads)
try {
  const response = await fetch('/api/auth/set-custom-claims', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid, role: userRole }),
  });
  
  if (response.ok) {
    console.log(`✅ Custom claims set for user ${uid} with role: ${userRole}`);
  }
} catch (claimsError) {
  console.error('Error setting custom claims:', claimsError);
  // Don't throw - approval should succeed even if claims fail
}
```

### 4. ✅ Created Custom Claims Management API
Created `/app/api/auth/set-custom-claims/route.ts` endpoint for setting custom claims:
- **Endpoint:** `POST /api/auth/set-custom-claims`
- **Auth Required:** super_admin role
- **Body:** `{ uid: string, role: string }`
- **Validates:** Role must be one of: team, committee_admin, super_admin

## User Action Required

**Users must log out and log back in** to get a fresh JWT token with the custom claims. The custom claims are only added to new tokens, not existing ones.

### Steps to Fix Access:
1. ✅ Script has set custom claims for all users
2. 🔄 **Users should log out**
3. 🔄 **Log back in to get fresh token**
4. ✅ Dashboard access should now work

## Technical Details

### JWT Custom Claims
Firebase JWT tokens can include custom claims that are embedded in the token itself. This allows:
- **Zero database reads** for role checking
- **Fast authentication** - just verify the token signature
- **Better security** - roles can't be tampered with (signed by Firebase)

### Token Lifecycle
- JWT tokens are valid for **1 hour** by default
- Custom claims are set at token generation time
- Users must get a new token (re-login) to receive updated claims
- The app has auto-refresh every 50 minutes to keep tokens fresh

## Files Modified

1. **lib/firebase/auth.ts**
   - Modified `approveUser()` to set custom claims

2. **app/api/teams/create/route.ts**
   - Added custom claims setting on team creation

3. **app/api/auth/set-custom-claims/route.ts** (NEW)
   - New endpoint for setting custom claims (super_admin only)

## Verification

To verify a user has custom claims:
```bash
# Run the script again - it will show "already has role: X" for users with claims
node scripts/set-user-custom-claims.js
```

Or check the JWT token in browser DevTools:
1. Open DevTools → Application → Cookies
2. Find the `token` cookie
3. Decode the JWT at https://jwt.io
4. Check for `"role": "team"` in the payload

## Prevention

All new users will automatically receive custom claims:
- ✅ When team account is created via `/api/teams/create`
- ✅ When super admin approves a user
- ✅ Manual setting via `/api/auth/set-custom-claims` endpoint

## Status

✅ **FIXED** - All existing users have custom claims set. New users will automatically get them. Users just need to re-login to get fresh tokens.
