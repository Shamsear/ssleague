# 🔧 Quick Fix: Permission Error

## The Problem
You're seeing: `Missing or insufficient permissions`

This happens because the new `invites` collection needs security rules in Firebase.

## ⚡ Quick Fix (5 minutes)

### Step 1: Open Firebase Console
```
Go to: https://console.firebase.google.com/
Select: Your project
```

### Step 2: Navigate to Firestore Rules
```
Click: "Firestore Database" (left sidebar)
Click: "Rules" tab (top)
```

### Step 3: Copy Updated Rules
```
Open: firestore.rules file in your project
Press: Ctrl+A (select all)
Press: Ctrl+C (copy)
```

### Step 4: Paste in Firebase Console
```
Click: In the rules editor in Firebase Console
Press: Ctrl+A (select all existing rules)
Press: Ctrl+V (paste new rules)
Click: "Publish" button
Wait: For "Rules published successfully" message
```

### Step 5: Refresh Your App
```
Go back to: Your app
Press: Ctrl+Shift+R (hard refresh)
Try: Navigate to /dashboard/superadmin/invites
```

## ✅ That's It!

The permission error should now be gone.

## 🎯 What Changed?

The updated rules added two new sections at the bottom:

1. **invites collection** - Allows super admins to manage invite codes
2. **inviteUsages collection** - Tracks who used which invite

## 📝 Visual Guide

```
Firebase Console
├── Firestore Database
│   ├── Data (tab)
│   └── Rules (tab) ← Go here
│       ├── [Your current rules]
│       └── [Click "Publish" after pasting]
```

## 🆘 Still Not Working?

1. **Verify you're logged in as super admin**
   - Check Firestore → users collection
   - Find your user document
   - Ensure `role: "super_admin"`

2. **Wait 30 seconds**
   - Rules can take a moment to propagate

3. **Clear cache completely**
   - Close all browser tabs
   - Reopen and try again

## 📞 Need More Help?

See detailed guide: `DEPLOY_FIRESTORE_RULES.md`
