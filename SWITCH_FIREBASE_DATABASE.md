# How to Switch to a New Firebase Database

## Overview
This guide will help you switch from your current Firebase database (which has quota limitations) to a new Firebase project with a fresh quota.

## Prerequisites
- Access to Firebase Console (https://console.firebase.google.com/)
- Google Account

---

## Step 1: Create a New Firebase Project

1. Go to **[Firebase Console](https://console.firebase.google.com/)**
2. Click **"Add project"** or **"Create a project"**
3. Enter a project name (e.g., "Fantasy League App v2" or "Fantasy League Backup")
4. Click **Continue**
5. (Optional) Enable Google Analytics if needed
6. Click **Create project**
7. Wait for the project to be created (takes ~30 seconds)

---

## Step 2: Enable Firestore Database

1. In your new Firebase project, go to **Firestore Database** from the left sidebar
2. Click **"Create database"**
3. Select a starting mode:
   - **Production mode** (recommended) - Start with security rules
   - **Test mode** - Open for testing (less secure)
4. Choose a Cloud Firestore location (select the closest region to your users)
5. Click **Enable**

---

## Step 3: Set Up Authentication

1. Go to **Authentication** from the left sidebar
2. Click **"Get started"**
3. Enable the authentication methods you're using:
   - **Email/Password**: Click on it → Enable → Save
   - Add any other methods you need (Google, Facebook, etc.)

---

## Step 4: Get Your New Firebase Configuration

1. In Firebase Console, click the **Settings gear icon** (⚙️) → **Project settings**
2. Scroll down to **"Your apps"** section
3. If you don't see a web app, click **"Add app"** → Select **Web icon (</>)**
   - Give it a nickname (e.g., "Fantasy League Web App")
   - Click **"Register app"**
4. You'll see your Firebase configuration object that looks like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890",
  measurementId: "G-XXXXXXXXXX"
};
```

5. **Copy all these values** - you'll need them in the next step

---

## Step 5: Update Your Environment Variables

1. Open your `.env.local` file in the project root directory
2. Replace the existing Firebase configuration values with your new ones:

```env
# Firebase Configuration - NEW DATABASE
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-new-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-new-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-new-project-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef1234567890
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

3. **Save the file**

---

## Step 6: Restart Your Development Server

Since environment variables are loaded at build time, you need to restart your server:

### PowerShell:
```powershell
# Stop the current server (press Ctrl+C if running)

# Start the server again
npm run dev
```

---

## Step 7: Verify the Connection

1. Open your application in the browser (usually http://localhost:3000)
2. Check the browser console (F12 → Console tab)
3. Look for any Firebase connection errors
4. Try logging in or registering a new account to test authentication

---

## Step 8: Set Up Firestore Security Rules

1. Go to **Firestore Database** → **Rules** tab in Firebase Console
2. Replace the default rules with your security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isCommitteeAdmin() {
      return isAuthenticated() && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'committee_admin';
    }
    
    function isTeamAdmin() {
      return isAuthenticated() && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'team_admin';
    }
    
    function isSuperAdmin() {
      return isAuthenticated() && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'super_admin';
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated() && 
                      (request.auth.uid == userId || isSuperAdmin());
    }
    
    // Football players collection
    match /footballplayers/{playerId} {
      allow read: if isAuthenticated();
      allow write: if isCommitteeAdmin() || isSuperAdmin();
    }
    
    // Teams collection
    match /teams/{teamId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update: if isAuthenticated() && 
                       (resource.data.admin_uid == request.auth.uid || 
                        isCommitteeAdmin() || 
                        isSuperAdmin());
      allow delete: if isCommitteeAdmin() || isSuperAdmin();
    }
    
    // Seasons collection
    match /seasons/{seasonId} {
      allow read: if isAuthenticated();
      allow write: if isSuperAdmin();
    }
    
    // Real players collection
    match /realplayers/{playerId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated();
    }
    
    // Invites collection
    match /invites/{inviteId} {
      allow read: if isAuthenticated();
      allow write: if isCommitteeAdmin() || isSuperAdmin();
    }
    
    // Password reset requests
    match /password_reset_requests/{requestId} {
      allow read: if isAuthenticated() && 
                     (resource.data.uid == request.auth.uid || isSuperAdmin());
      allow create: if true; // Anyone can create a reset request
      allow update, delete: if isSuperAdmin();
    }
  }
}
```

3. Click **Publish**

---

## Step 9: Migrate Data (Optional)

If you want to move your existing data to the new database:

### Option A: Export and Import via Backup

1. Go to your **old Firebase project** → Database page
2. Use the backup feature you built in the app:
   - Navigate to `/dashboard/committee/database`
   - Click **"Create Backup"** button
   - Download the JSON backup file

3. Switch to your **new Firebase project** (update .env.local as described above)
4. Restart your development server
5. Navigate to `/dashboard/committee/database`
6. Use the **"Restore from Backup"** feature
7. Upload the JSON backup file you downloaded

### Option B: Manual Data Migration (For Large Datasets)

Use Firebase CLI to export/import:

```powershell
# Install Firebase CLI (if not installed)
npm install -g firebase-tools

# Login to Firebase
firebase login

# Export from old project
firebase firestore:export gs://old-project-id.appspot.com/exports --project old-project-id

# Import to new project
firebase firestore:import gs://old-project-id.appspot.com/exports --project new-project-id
```

---

## Step 10: Update Firebase Settings (Recommended)

### Increase Quotas (if needed)
1. Go to **Firestore Database** → **Usage** tab
2. Check your current usage and limits
3. If you need more, go to **Settings** → **Usage and billing**
4. Upgrade to **Blaze Plan** (Pay as you go) for higher quotas

### Set Up Alerts
1. Go to **Usage and billing** → **Budget & alerts**
2. Set up budget alerts to monitor your usage
3. Set a monthly budget limit if desired

---

## Troubleshooting

### Issue: "Permission denied" errors
**Solution**: Make sure you've set up Firestore security rules (Step 8)

### Issue: Authentication not working
**Solution**: 
- Verify Email/Password authentication is enabled in Firebase Console
- Check that all environment variables are correctly set
- Restart your development server

### Issue: Can't see data in Firestore
**Solution**:
- Check Firestore Database → Data tab in Firebase Console
- Make sure you're looking at the correct project
- Try importing data again using the backup/restore feature

### Issue: Environment variables not updating
**Solution**:
- Make sure you saved the `.env.local` file
- Restart your development server completely (stop and start again)
- Clear browser cache and reload the page

---

## Important Notes

1. **Keep your `.env.local` file secure** - Never commit it to version control
2. **The old database will still exist** - You can keep it as a backup or delete it later
3. **Update any external services** - If you use Firebase in other places (mobile apps, etc.), update their configurations too
4. **Test thoroughly** - Test all features of your app with the new database before going to production

---

## Verification Checklist

Before considering the migration complete, verify:

- [ ] Can register new users
- [ ] Can login with existing/new users
- [ ] Can view players list
- [ ] Can import players from SQLite
- [ ] Can manage teams
- [ ] Can update player auction eligibility
- [ ] All committee admin features work
- [ ] All team admin features work
- [ ] Security rules are properly set

---

## Need Help?

If you encounter any issues:
1. Check the browser console for error messages
2. Check Firebase Console → Firestore Database → Usage tab for any errors
3. Verify all environment variables are correct
4. Make sure Firebase security rules are published
5. Check that all authentication methods are enabled

---

## Rollback Plan

If something goes wrong and you need to switch back to the old database:

1. Keep your old `.env.local` values backed up
2. Simply replace the values in `.env.local` with the old ones
3. Restart the development server
4. Your app will reconnect to the old database
