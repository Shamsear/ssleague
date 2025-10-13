# 🔥 Firebase Setup Guide - Fix Permissions Error

## ⚠️ Problem
You're getting **"Missing or insufficient permissions"** error because Firestore security rules haven't been configured.

## ✅ Solution - Quick Fix

### Step 1: Deploy Firestore Security Rules

**Go to Firebase Console:**
1. Visit https://console.firebase.google.com
2. Select your project
3. Click **"Firestore Database"** → **"Rules"** tab
4. Copy the contents from `firestore.rules` file (in your project root)
5. Paste into the Firebase Console rules editor
6. Click **"Publish"**
7. **Wait 1-2 minutes** for rules to propagate

### Step 2: Create Your First Admin User

**Option A: Quick Setup (Recommended)**
1. Register a new user through your app
2. Go to Firebase Console → Firestore Database → Data
3. Find the user in `users` collection
4. Edit the document and change `role` to `"super_admin"`
5. Add field `permissions` with value `["all"]`
6. Log out and log back in

**Option B: Manual Setup**
1. Go to Firebase Console → Authentication → Add user
2. Note the UID of the created user
3. Go to Firestore Database → Start collection → `users`
4. Create document with ID = [UID]:
   ```
   uid: [the UID]
   email: [user email]
   username: "admin"
   role: "super_admin"
   isActive: true
   permissions: ["all"]
   createdAt: [current timestamp]
   updatedAt: [current timestamp]
   ```
5. Create another collection → `usernames`
6. Create document with ID = "admin":
   ```
   uid: [the same UID]
   createdAt: [current timestamp]
   ```

### Step 3: Test Login
1. Clear browser cache
2. Restart dev server: `npm run dev`
3. Login with your admin credentials
4. Should redirect to `/dashboard/superadmin` ✅

---

## 📋 Debug Checklist

If still not working, check:
- [ ] Rules published in Firebase Console (Rules tab shows your rules)
- [ ] `.env.local` has all Firebase config variables
- [ ] Dev server restarted after changes
- [ ] User document exists in Firestore `users` collection
- [ ] User has `role` field set correctly
- [ ] Browser cache cleared
- [ ] Waited 1-2 minutes after publishing rules

---

## 🔍 Understanding the Rules

The `firestore.rules` file allows:
- ✅ Users can read/write their own data
- ✅ Super admins can read/write everything
- ✅ Committee admins can read all users
- ✅ Anyone can read usernames collection (for availability check)
- ✅ Authenticated users can access their role-based dashboards

---

## 🚀 What's Next

After fixing permissions:
1. Login with different roles to test routing
2. Verify each dashboard loads correctly
3. Start implementing button functionality
4. Add more collections as needed

---

**Important**: Always wait 1-2 minutes after publishing Firestore rules before testing!
