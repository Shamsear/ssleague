# Fix Vercel Login Loading Issue

## Problem
Login page is stuck loading when deployed on Vercel, but works fine locally.

## Root Causes

### 1. Missing Firebase Environment Variables
Vercel needs all Firebase configuration set as environment variables.

### 2. Firebase Admin SDK Not Configured
The username-to-email API uses Firebase Admin SDK which requires service account credentials.

### 3. Client-Side Firebase Not Initializing
Firebase client may fail to initialize if environment variables are missing.

## Solution

### Step 1: Set Up Firebase Environment Variables in Vercel

Go to your Vercel project → Settings → Environment Variables and add:

#### Client-Side Firebase (Required)
```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

#### Server-Side Firebase Admin (Critical for API Routes)
```
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=your_service_account@your_project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour_Private_Key_Here\n-----END PRIVATE KEY-----"
```

**Important:** 
- Set ALL variables for "Production", "Preview", and "Development" environments
- The private key must include the newline characters as `\n`
- Wrap the private key in double quotes

### Step 2: Get Firebase Service Account Credentials

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to Project Settings (gear icon) → Service Accounts
4. Click "Generate New Private Key"
5. Download the JSON file
6. Use these values:
   - `FIREBASE_ADMIN_PROJECT_ID` → `project_id` from JSON
   - `FIREBASE_ADMIN_CLIENT_EMAIL` → `client_email` from JSON
   - `FIREBASE_ADMIN_PRIVATE_KEY` → `private_key` from JSON (keep the `\n` characters)

### Step 3: Check Vercel Build Logs

After setting environment variables, redeploy and check logs:

```bash
# Check Vercel logs
vercel logs [deployment-url]
```

Look for:
- `[username-to-email API]` logs
- `[Login]` logs
- Firebase initialization errors

### Step 4: Test the API Endpoints

Once deployed, test the API directly:

```bash
# Test username-to-email API
curl -X POST https://your-app.vercel.app/api/auth/username-to-email \
  -H "Content-Type: application/json" \
  -d '{"username":"your_username"}'
```

Expected response:
```json
{
  "success": true,
  "email": "user@example.com"
}
```

### Step 5: Enable Debug Mode

The code now includes detailed console logging. To view logs:

1. Open browser DevTools (F12)
2. Go to Console tab
3. Try to login
4. Look for logs starting with:
   - `[Login]` - Frontend login flow
   - `[username-to-email API]` - Backend API calls

### Step 6: Common Issues & Solutions

#### Issue: "Firebase admin initialization error"
**Solution:** Make sure `FIREBASE_ADMIN_*` variables are set correctly in Vercel

#### Issue: "Username not found"
**Solution:** 
- Check that the `usernames` collection exists in Firestore
- Verify the username is stored in lowercase
- Check Firestore security rules allow server-side reads

#### Issue: API timeout
**Solution:**
- Check Vercel function timeout (default 10s on Free tier)
- Optimize Firestore queries
- Consider adding Redis cache for username lookups

#### Issue: "Permission denied"
**Solution:**
- Update Firestore security rules to allow admin access
- Verify service account has proper permissions

### Step 7: Firestore Security Rules

Make sure your Firestore rules allow the admin SDK to read usernames:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Usernames collection (read-only via server)
    match /usernames/{username} {
      allow read: if request.auth != null;
      allow write: if false; // Only via admin SDK
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }
  }
}
```

### Step 8: Monitor Performance

Add Vercel Analytics to monitor:
- API response times
- Error rates
- User login success rates

### Quick Checklist

- [ ] All `NEXT_PUBLIC_FIREBASE_*` variables set in Vercel
- [ ] All `FIREBASE_ADMIN_*` variables set in Vercel
- [ ] Environment variables set for all environments (Production, Preview, Development)
- [ ] Firebase service account has Firestore read permissions
- [ ] Firestore security rules allow necessary reads
- [ ] Redeployed after adding environment variables
- [ ] Tested API endpoint directly
- [ ] Checked Vercel logs for errors
- [ ] Browser console shows detailed debug logs

## Additional Resources

- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Firebase Admin SDK Setup](https://firebase.google.com/docs/admin/setup)
- [Troubleshooting Firebase Auth](https://firebase.google.com/docs/auth/web/start#troubleshooting)

## Support

If the issue persists:
1. Check Vercel deployment logs
2. Check browser console for client-side errors
3. Test the API endpoints directly
4. Verify Firebase service account permissions
