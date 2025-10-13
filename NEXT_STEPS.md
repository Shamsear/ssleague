# 🎯 Firebase Database Switch - Next Steps

## ✅ Completed Steps

- [x] **Old configuration backed up** to `.env.local.backup_2025-10-03_19-54-18`
- [x] **New Firebase config applied** to `.env.local`
  - Project: **eaguedemo**
  - Old Project: eague-92e4f

---

## 📋 What You Need to Do Next

### 1️⃣ RESTART YOUR DEVELOPMENT SERVER (CRITICAL!)

**Stop your current server and restart it:**
```powershell
# Press Ctrl+C to stop the current server

# Then start it again
npm run dev
```

⚠️ **Important:** Environment variables are loaded at startup, so you MUST restart!

---

### 2️⃣ Set Up Authentication in New Firebase Project

1. Go to **[Firebase Console](https://console.firebase.google.com/)**
2. Select your **eaguedemo** project
3. Click **Authentication** from the left sidebar
4. Click **Get started**
5. Click **Email/Password** provider
6. Toggle **Enable** switch to ON
7. Click **Save**

---

### 3️⃣ Set Up Firestore Security Rules

1. In Firebase Console (eaguedemo project)
2. Go to **Firestore Database** from left sidebar
3. Click the **Rules** tab
4. Replace the content with these rules:

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
      allow create: if true;
      allow update, delete: if isSuperAdmin();
    }
  }
}
```

5. Click **Publish**

---

### 4️⃣ Test the Connection

After restarting the server, test these:

1. Open **http://localhost:3000** in your browser
2. Open **Browser Console** (Press F12 → Console tab)
3. Check for any Firebase errors
4. Try **registering a new user** to test authentication

---

### 5️⃣ Migrate Your Data (Optional but Recommended)

#### Option A: If You Want to Keep Your Old Data

**BEFORE you switched .env.local** (you need to rollback temporarily):

```powershell
# 1. Restore old config temporarily
Copy-Item .env.local.backup_2025-10-03_19-54-18 .env.local

# 2. Restart server
npm run dev

# 3. Go to http://localhost:3000/dashboard/committee/database
# 4. Click "Create Backup" button
# 5. Download the JSON file

# 6. Now switch back to new config
```

Then copy the new config back to `.env.local`:
```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCERFgJcwl0gHFQXhTPMavt26q0RaKDHF8
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=eaguedemo.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=eaguedemo
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=eaguedemo.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=811342007569
NEXT_PUBLIC_FIREBASE_APP_ID=1:811342007569:web:c1b78c0c5b336f989450b0
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-3WCXNP2S8B
```

Then:
```powershell
# 7. Restart server again
npm run dev

# 8. Go to http://localhost:3000/dashboard/committee/database
# 9. Click "Restore from Backup"
# 10. Upload the JSON file you downloaded
```

#### Option B: If You Want to Start Fresh

Just start importing players directly into the new database using the SQLite import feature.

---

## 🔍 Verification Checklist

Test these features after the switch:

- [ ] Server restarts without errors
- [ ] Can access the application homepage
- [ ] Can register a new user
- [ ] Can login with the new user
- [ ] Can access the dashboard
- [ ] Can import players from SQLite
- [ ] All pages load without permission errors

---

## 🆘 Troubleshooting

### Problem: "Permission denied" errors
**Solution:** Make sure you completed Step 3 (Security Rules) and published them

### Problem: Can't login or register
**Solution:** Make sure you completed Step 2 (Enable Email/Password authentication)

### Problem: Server shows old data
**Solution:** 
- Clear browser cache (Ctrl+Shift+Delete)
- Or use Incognito/Private mode
- Make sure you restarted the server

### Problem: Changes not taking effect
**Solution:** 
- Verify `.env.local` has the new values
- Completely stop and restart the dev server (Ctrl+C then npm run dev)
- Check there are no other `.env` files overriding your settings

---

## 🔄 Rollback (If Needed)

If something goes wrong and you want to go back to the old database:

```powershell
# 1. Restore old configuration
Copy-Item .env.local.backup_2025-10-03_19-54-18 .env.local

# 2. Restart server
npm run dev
```

Your old database (eague-92e4f) will still have all its data intact!

---

## 📊 New vs Old Database

| Property | Old Database | New Database |
|----------|-------------|--------------|
| Project ID | eague-92e4f | eaguedemo |
| Status | Quota limited | Fresh quota ✅ |
| Data | Preserved (if backed up) | Empty (ready for import) |
| Backup File | .env.local.backup_2025-10-03_19-54-18 | N/A |

---

## ✨ Benefits of the Switch

- ✅ No more quota limitations
- ✅ Fresh Firestore instance with full limits
- ✅ Can still access old database if needed (it's backed up)
- ✅ Same codebase - only environment variables changed
- ✅ Duplicate import fix is already applied

---

## 📞 Need Help?

If you encounter issues:
1. Check the browser console (F12) for error messages
2. Check Firebase Console → Firestore Database → Usage for any errors
3. Verify Steps 2 and 3 are completed (Authentication + Security Rules)
4. Try the rollback procedure if needed

**Start with Step 1 - Restart your development server!**
