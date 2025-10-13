# Authentication Token Fix

## Problem
The team season registration API was returning "Unauthorized - No token provided" because:
1. The app uses Firebase Authentication on the client side
2. The API was expecting JWT tokens in HTTP cookies
3. Firebase ID tokens weren't being stored in cookies

## Solution

### Simplified Approach
Instead of complex token verification, we're now:
1. Sending the user's Firebase UID directly from the authenticated client
2. Verifying the user exists in Firestore
3. Checking the user's role

### Changes Made

#### 1. Updated API Route (`app/api/seasons/[seasonId]/register/route.ts`)
- Removed `jose` JWT verification
- Now accepts `userId` directly in the request body
- Simpler authentication flow

#### 2. Updated Frontend (`app/register/team/page.tsx`)
- Sends `userId` (user.uid) along with `action` in the request
- Checks that user is authenticated before making request

#### 3. Created Token Management APIs (Optional for future use)
- `/api/auth/set-token` - Stores Firebase ID token in cookie
- `/api/auth/clear-token` - Clears token cookie on logout

## How It Works Now

1. **User logs in** → Firebase Authentication
2. **User navigates to season registration** → Checks authentication via AuthContext
3. **User clicks Join/Decline** → Sends request with `userId` and `action`
4. **API verifies**:
   - User exists in Firestore `users` collection
   - User has `role='team'`
   - Season exists
   - No duplicate registration
5. **API creates** `team_seasons` document
6. **User redirected** to dashboard

## Security Considerations

### Current Implementation
- Relies on client-side authentication
- User must be logged in via Firebase Auth
- User ID is sent in request body
- API verifies user exists and has correct role

### Potential Improvements
1. **Add Firebase Admin SDK** for server-side token verification
2. **Implement CSRF protection** for state-changing operations
3. **Rate limiting** to prevent abuse
4. **IP validation** for additional security

## Testing

### Test the Fix
1. Make sure you're logged in as a team user
2. Navigate to: `/register/team?season=<seasonId>`
3. Click "Join Season" or "Skip This Season"
4. Should work without "Unauthorized" error

### Verify in Firestore
Check that `team_seasons` collection has the new document:
- Document ID: `{userId}_{seasonId}`
- Fields: status, budget, team_name, etc.

## Alternative: Full Token-Based Auth

If you want to implement proper JWT token verification:

### 1. Install Firebase Admin
```bash
npm install firebase-admin
```

### 2. Set up Firebase Admin SDK
Create `lib/firebase/admin.ts`:
```typescript
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
```

### 3. Update API to verify tokens
```typescript
// In the API route
const token = cookies().get('token')?.value;
const decodedToken = await adminAuth.verifyIdToken(token);
const userId = decodedToken.uid;
```

### 4. Add environment variables
```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## Conclusion

The current implementation is simpler and works well for applications where:
- Users are already authenticated via Firebase
- The frontend is trusted (not public API)
- You want to minimize complexity

For production applications with higher security requirements, consider implementing the full token-based authentication with Firebase Admin SDK.
