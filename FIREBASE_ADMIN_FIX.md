# Firebase Admin Authentication Fix

## Problem
Firebase Admin SDK is returning "16 UNAUTHENTICATED" error when trying to access Firestore.

## Solution

### Step 1: Generate a New Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click the gear icon ⚙️ → **Project settings**
4. Go to **Service accounts** tab
5. Click **Generate new private key**
6. Click **Generate key** - this will download a JSON file

### Step 2: Extract the Credentials

Open the downloaded JSON file. You'll see something like:

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "...",
  "token_uri": "...",
  "auth_provider_x509_cert_url": "...",
  "client_x509_cert_url": "..."
}
```

### Step 3: Update .env.local

Replace the values in your `.env.local` file:

```bash
FIREBASE_ADMIN_PROJECT_ID="your-project-id"
FIREBASE_ADMIN_CLIENT_EMAIL="firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com"
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
```

**IMPORTANT**: 
- Keep the quotes around the private key
- The `\n` characters should be literal backslash-n, not actual newlines
- The entire key should be on ONE line in the .env file

### Step 4: Verify IAM Permissions

Make sure the service account has these roles:
1. Go to [Google Cloud Console IAM](https://console.cloud.google.com/iam-admin/iam)
2. Find your service account email
3. Ensure it has one of these roles:
   - **Firebase Admin SDK Administrator Service Agent**
   - **Cloud Datastore User**
   - **Editor** or **Owner** (most permissive, good for development)

### Step 5: Test the Connection

Run the test script:

```bash
node test-firebase-admin.js
```

You should see:
```
✅ Firebase Admin initialized successfully with service account!
✅ Firestore access successful! Found X season(s)
```

### Step 6: Restart the Dev Server

Stop any running Next.js dev servers and start fresh:

```bash
# Kill all node processes
Get-Process | Where-Object {$_.ProcessName -like "*node*"} | Stop-Process -Force

# Start dev server
npm run dev
```

### Alternative: Use Application Default Credentials (ADC)

If you're having persistent issues with service account keys, you can use Application Default Credentials:

1. Install Google Cloud SDK
2. Run: `gcloud auth application-default login`
3. Remove the `FIREBASE_ADMIN_*` variables from `.env.local`
4. The admin SDK will use ADC automatically

## Common Issues

### Issue: "UNAUTHENTICATED" Error
- **Cause**: Invalid or expired service account key
- **Fix**: Generate a new key from Firebase Console

### Issue: "PERMISSION_DENIED" Error  
- **Cause**: Service account lacks IAM permissions
- **Fix**: Add proper roles in GCP IAM console

### Issue: Private key format issues
- **Cause**: Newlines in .env file
- **Fix**: Ensure the entire private key is on ONE line with literal `\n` characters

## Need More Help?

Run the diagnostics:
```bash
node test-firebase-admin.js
```

This will show you exactly what's wrong with your configuration.
