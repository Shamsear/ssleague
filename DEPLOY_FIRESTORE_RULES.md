# Deploy Firestore Security Rules

## ⚠️ Important: Deploy Rules to Fix Permission Error

The "Missing or insufficient permissions" error occurs because the new `invites` and `inviteUsages` collections don't have security rules yet in your Firebase project.

## 🚀 How to Deploy Rules

### Option 1: Firebase Console (Recommended)

1. **Open Firebase Console**
   - Go to https://console.firebase.google.com/
   - Select your project

2. **Navigate to Firestore Rules**
   - Click on "Firestore Database" in the left sidebar
   - Click on the "Rules" tab at the top

3. **Copy the Updated Rules**
   - Open `firestore.rules` file in your project
   - Copy ALL the content (Ctrl+A, Ctrl+C)

4. **Paste and Publish**
   - Paste the rules into the Firebase Console editor
   - Click "Publish" button
   - Wait for confirmation

5. **Verify**
   - Refresh your app
   - The permission error should be gone

### Option 2: Firebase CLI (If you have firebase.json)

If you want to use the Firebase CLI in the future:

```bash
# Install Firebase CLI (if not installed)
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase (creates firebase.json)
firebase init firestore

# Deploy rules
firebase deploy --only firestore:rules
```

## 📋 What Was Added to Rules

The updated `firestore.rules` file now includes:

### 1. Invites Collection Rules
```javascript
match /invites/{inviteCode} {
  // Anyone can read to validate during registration
  allow read: if true;
  
  // Only super admins can create
  allow create: if isSuperAdmin() && 
    request.resource.data.createdBy == request.auth.uid;
  
  // Super admins or authenticated users can update (for marking as used)
  allow update: if isSuperAdmin() || (
    isSignedIn() && 
    request.resource.data.diff(resource.data).affectedKeys().hasOnly(['usedCount', 'usedBy', 'isActive']) &&
    request.resource.data.usedCount >= resource.data.usedCount
  );
  
  // Only super admins can delete
  allow delete: if isSuperAdmin();
}
```

### 2. Invite Usages Collection Rules
```javascript
match /inviteUsages/{usageId} {
  // Only super admins can read
  allow read: if isSuperAdmin();
  
  // Any authenticated user can create (during registration)
  allow create: if isSignedIn();
  
  // No one can update or delete (audit trail)
  allow update: if false;
  allow delete: if false;
}
```

## 🔒 Security Notes

### Why Allow Public Read on Invites?

- Users need to validate invite codes BEFORE they create an account
- The invite validation happens before authentication
- Sensitive data (like `usedBy` array) is not exposed in the UI
- Super admins are still the only ones who can see full invite details

### Why Restrict Updates?

- Only super admins can fully manage invites
- Regular users can only increment usage (during registration)
- Prevents tampering with invite limits or expiration

### Why Block Updates on inviteUsages?

- Creates an immutable audit trail
- Tracks exactly who used which invite and when
- Prevents manipulation of usage history

## ✅ After Deployment

Once you've deployed the rules:

1. **Test Super Admin Access**
   - Login as super admin
   - Go to `/dashboard/superadmin/invites`
   - Should load without errors

2. **Test Invite Validation**
   - Open a registration link with invite code
   - Should validate and show season info

3. **Test Registration**
   - Complete registration with invite
   - Should work without permission errors

## 🆘 Troubleshooting

### Still Getting Permission Errors?

1. **Clear Browser Cache**
   - Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

2. **Check Firebase Console**
   - Verify rules were actually published
   - Look for any red error indicators in the rules editor

3. **Check User Role**
   - Ensure your test user actually has `role: 'super_admin'` in Firestore
   - Go to Firestore Database → users collection → your user document

4. **Wait a Moment**
   - Sometimes rule changes take 10-30 seconds to propagate
   - Try again after waiting

### Rules Syntax Error?

If Firebase Console shows a syntax error:

1. Make sure you copied the ENTIRE `firestore.rules` file
2. Check for any missing braces `{` or `}`
3. Ensure all quotes are properly closed

### Need to Revert?

If something goes wrong, you can always revert to previous rules in Firebase Console:
- Click "Rules" tab
- Look for "Rules history" 
- Select a previous version
- Click "Publish"

## 📞 Next Steps

After deploying the rules:

1. Test the invite system end-to-end
2. Create a test season
3. Create a test invite
4. Register using the invite
5. Verify permissions work correctly

---

**Remember: Always deploy rules to Firebase Console after making changes to `firestore.rules` file!**
