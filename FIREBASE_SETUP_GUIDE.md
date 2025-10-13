# 🔥 Firebase Complete Setup Guide

## Overview
This guide covers all necessary Firebase setup steps including:
- Firestore indexes (with auto-creation links)
- Security rules
- Creating the first superadmin user
- Authentication setup

---

## 📊 Part 1: Firestore Indexes

### Why Indexes Are Needed?
Firestore requires composite indexes when you query with:
- Multiple `where()` clauses
- Combination of `where()` and `orderBy()`
- Multiple `orderBy()` clauses

### 🚀 Quick Setup - Click Links to Auto-Create Indexes

**Your Firebase Project ID:** `eaguedemo`

#### Index 1: Password Reset Requests (status + requestedAt)
**Used for:** Filtering pending password reset requests and sorting by date

**📋 Fields:**
- Collection: `passwordResetRequests`
- Field 1: `status` (Ascending)
- Field 2: `requestedAt` (Descending)
- Field 3: `__name__` (Descending)

**🔗 Click to Create:**
```
https://console.firebase.google.com/project/eaguedemo/firestore/indexes?create_composite=Clhwcm9qZWN0cy9lYWd1ZWRlbW8vZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL3Bhc3N3b3JkUmVzZXRSZXF1ZXN0cy9pbmRleGVzL18QARoKCgZzdGF0dXMQARoOCgpyZXF1ZXN0ZWRBdBACGggKBF9fbmFtZRACIAE
```

---

#### Index 2: Teams (season_id + created_at)
**Used for:** Filtering teams by season and sorting by creation date

**📋 Fields:**
- Collection: `teams`
- Field 1: `season_id` (Ascending)
- Field 2: `created_at` (Descending)
- Field 3: `__name__` (Descending)

**🔗 Click to Create:**
```
https://console.firebase.google.com/project/eaguedemo/firestore/indexes?create_composite=ClJwcm9qZWN0cy9lYWd1ZWRlbW8vZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL3RlYW1zL2luZGV4ZXMvXxABGgsKB3NlYXNvbl9pZBABGgwKCGNyZWF0ZWRfYXQQAhoICgRfX25hbWUQAiAB
```

---

#### Index 3: Invites (seasonId + createdAt)
**Used for:** Filtering invites by season and sorting by creation date

**📋 Fields:**
- Collection: `invites`
- Field 1: `seasonId` (Ascending)
- Field 2: `createdAt` (Descending)
- Field 3: `__name__` (Descending)

**🔗 Click to Create:**
```
https://console.firebase.google.com/project/eaguedemo/firestore/indexes?create_composite=ClRwcm9qZWN0cy9lYWd1ZWRlbW8vZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL2ludml0ZXMvaW5kZXhlcy9fEAEaCwoHc2Vhc29uSWQQARoLCgljcmVhdGVkQXQQAhoICgRfX25hbWUQAiAB
```

---

#### Index 4: Invite Usages (inviteCode + usedAt)
**Used for:** Viewing who used specific invites, sorted by date

**📋 Fields:**
- Collection: `inviteUsages`
- Field 1: `inviteCode` (Ascending)
- Field 2: `usedAt` (Descending)
- Field 3: `__name__` (Descending)

**🔗 Click to Create:**
```
https://console.firebase.google.com/project/eaguedemo/firestore/indexes?create_composite=Clhwcm9qZWN0cy9lYWd1ZWRlbW8vZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL2ludml0ZVVzYWdlcy9pbmRleGVzL18QARoMCgppbnZpdGVDb2RlEAEaCgoGdXNlZEF0EAIaCAoEX19uYW1lEAIgAQ
```

---

#### Index 5: Users (role + seasonId)
**Used for:** Finding committee admins by season

**📋 Fields:**
- Collection: `users`
- Field 1: `role` (Ascending)
- Field 2: `seasonId` (Ascending)
- Field 3: `__name__` (Ascending)

**🔗 Click to Create:**
```
https://console.firebase.google.com/project/eaguedemo/firestore/indexes?create_composite=ClNwcm9qZWN0cy9lYWd1ZWRlbW8vZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL3VzZXJzL2luZGV4ZXMvXxABGgYKBHJvbGUQARoLCgdzZWFzb25JZBABGggKBF9fbmFtZRABIAE
```

---

#### Index 6: Football Players (season_id + is_sold)
**Used for:** Finding available players for auction

**📋 Fields:**
- Collection: `footballplayers`
- Field 1: `season_id` (Ascending)
- Field 2: `is_sold` (Ascending)
- Field 3: `__name__` (Ascending)

**🔗 Click to Create:**
```
https://console.firebase.google.com/project/eaguedemo/firestore/indexes?create_composite=Clxwcm9qZWN0cy9lYWd1ZWRlbW8vZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL2Zvb3RiYWxscGxheWVycy9pbmRleGVzL18QARoLCgdzZWFzb25faWQQARoKCgZpc19zb2xkEAEaCAoEX19uYW1lEAEgAQ
```

---

#### Index 7: Password Reset Requests (userId + status)
**Used for:** Finding pending requests for specific users

**📋 Fields:**
- Collection: `passwordResetRequests`
- Field 1: `userId` (Ascending)
- Field 2: `status` (Ascending)
- Field 3: `__name__` (Ascending)

**🔗 Click to Create:**
```
https://console.firebase.google.com/project/eaguedemo/firestore/indexes?create_composite=Clhwcm9qZWN0cy9lYWd1ZWRlbW8vZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL3Bhc3N3b3JkUmVzZXRSZXF1ZXN0cy9pbmRleGVzL18QARoICgR1c2VySWQQARoKCgZzdGF0dXMQARoICgRfX25hbWUQASAB
```

---

### 📝 Manual Index Creation (Alternative Method)

If the links don't work, you can create indexes manually:

1. Go to **[Firebase Console](https://console.firebase.google.com/)**
2. Select your **eaguedemo** project
3. Go to **Firestore Database** → **Indexes** tab
4. Click **Create Index**
5. Fill in the fields according to the specifications above
6. Click **Create**

---

## 🔒 Part 2: Security Rules

Already set up in `NEXT_STEPS.md`. If not done yet, copy these rules:

1. Go to **Firestore Database** → **Rules** tab
2. Replace content with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
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
    
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated() && 
                      (request.auth.uid == userId || isSuperAdmin());
    }
    
    match /footballplayers/{playerId} {
      allow read: if isAuthenticated();
      allow write: if isCommitteeAdmin() || isSuperAdmin();
    }
    
    match /teams/{teamId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update: if isAuthenticated() && 
                       (resource.data.admin_uid == request.auth.uid || 
                        isCommitteeAdmin() || 
                        isSuperAdmin());
      allow delete: if isCommitteeAdmin() || isSuperAdmin();
    }
    
    match /seasons/{seasonId} {
      allow read: if isAuthenticated();
      allow write: if isSuperAdmin();
    }
    
    match /realplayers/{playerId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated();
    }
    
    match /invites/{inviteId} {
      allow read: if isAuthenticated();
      allow write: if isCommitteeAdmin() || isSuperAdmin();
    }
    
    match /password_reset_requests/{requestId} {
      allow read: if isAuthenticated() && 
                     (resource.data.uid == request.auth.uid || isSuperAdmin());
      allow create: if true;
      allow update, delete: if isSuperAdmin();
    }
  }
}
```

3. Click **Publish**

---

## 👤 Part 3: Create First Superadmin User

### Option A: Using Firebase Console (Recommended)

1. **Create User in Authentication:**
   - Go to **Firebase Console** → **Authentication** → **Users**
   - Click **Add user**
   - Enter email: `admin@yourdomain.com`
   - Enter password: (choose a strong password)
   - Click **Add user**
   - **Copy the User UID** (you'll need it in the next step)

2. **Create User Document in Firestore:**
   - Go to **Firestore Database** → **Data** tab
   - Click **Start collection**
   - Collection ID: `users`
   - Click **Next**
   - Document ID: **Paste the User UID from step 1**
   - Add fields:

   | Field | Type | Value |
   |-------|------|-------|
   | `uid` | string | (Paste User UID) |
   | `email` | string | admin@yourdomain.com |
   | `username` | string | superadmin |
   | `displayName` | string | Super Administrator |
   | `role` | string | `super_admin` |
   | `isActive` | boolean | `true` |
   | `createdAt` | timestamp | (Click "Set to current time") |
   | `updatedAt` | timestamp | (Click "Set to current time") |

   - Click **Save**

3. **Test Login:**
   - Go to your app: http://localhost:3000/login
   - Login with the email and password you created
   - You should now have superadmin access!

---

### Option B: Using Code (After First Login)

If you already have an account, you can manually promote it to superadmin:

1. **Login to your app** with any existing account
2. **Get your User UID** from the Firebase Console → Authentication
3. **Update Firestore manually:**
   - Go to Firestore Database → Data → users → [Your UID]
   - Edit the document
   - Change `role` field to: `super_admin`
   - Save

---

## ✅ Part 4: Verification Checklist

After completing all steps, verify:

### Indexes Created:
- [ ] passwordResetRequests (status + requestedAt)
- [ ] teams (season_id + created_at)
- [ ] invites (seasonId + createdAt)
- [ ] inviteUsages (inviteCode + usedAt)
- [ ] users (role + seasonId)
- [ ] footballplayers (season_id + is_sold)
- [ ] passwordResetRequests (userId + status)

### Security Rules:
- [ ] Security rules published in Firestore

### Authentication:
- [ ] Email/Password authentication enabled
- [ ] First superadmin user created

### Superadmin Access:
- [ ] Can login as superadmin
- [ ] Can access `/dashboard/superadmin` routes
- [ ] Can create seasons
- [ ] Can manage password reset requests
- [ ] Can create invites

---

## 🔍 How to Check Index Status

1. Go to **Firebase Console** → **Firestore Database** → **Indexes**
2. You should see all indexes listed
3. Status should be **"Enabled"** (green)
4. If status is **"Building"** (yellow), wait a few minutes

---

## 🆘 Troubleshooting

### Index Creation Errors

**Problem:** "Index already exists"
- **Solution:** This is fine! The index is already created. Skip to the next one.

**Problem:** "Permission denied"
- **Solution:** Make sure you're logged into Firebase Console with the correct Google account that owns the project.

**Problem:** Links don't work
- **Solution:** Use the manual creation method described above.

### Superadmin Not Working

**Problem:** "Permission denied" when accessing superadmin pages
- **Solution:** 
  1. Check Firestore → users → [your UID]
  2. Verify `role` field is exactly: `super_admin` (lowercase, with underscore)
  3. Clear browser cache and reload
  4. Logout and login again

**Problem:** Can't create seasons or invites
- **Solution:** 
  1. Verify security rules are published
  2. Check browser console for errors (F12 → Console)
  3. Verify you're logged in as superadmin

---

## 📋 Quick Summary

### To set up your new Firebase database:

1. **✅ Done:** Environment variables updated
2. **✅ Done:** Server restarted
3. **🔲 TODO:** Click all 7 index creation links above (or create manually)
4. **🔲 TODO:** Publish security rules (if not done yet)
5. **🔲 TODO:** Create first superadmin user
6. **🔲 TODO:** Test superadmin access

### Estimated Time: 10-15 minutes

---

## 📞 Need Help?

If you encounter issues:
1. Check Firebase Console → Firestore Database → Usage for errors
2. Check browser console (F12) for error messages
3. Verify all indexes show "Enabled" status
4. Make sure security rules are published
5. Confirm superadmin role is set correctly in Firestore

---

## 🎯 Next Steps After Setup

Once setup is complete:
1. Create your first season (Superadmin Dashboard)
2. Generate invite codes for committee admins
3. Import players using the SQLite import feature
4. Start managing your fantasy league!

---

**Last Updated:** 2025-10-03
**Project:** eaguedemo
**Status:** Ready for use after completing the checklist above
