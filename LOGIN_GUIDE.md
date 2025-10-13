# 🔐 Login System Guide

## How Login Works

Your login system supports **both username and email** for signing in.

### Login Options:

#### Option 1: Login with Email (Recommended)
```
Email: user@example.com
Password: yourpassword
```
✅ **This always works** - No database lookup required

#### Option 2: Login with Username
```
Username: myusername
Password: yourpassword
```
⚠️ **Requires Firestore rules to be deployed** - Looks up email from username

---

## Current Behavior

### If Firestore Rules Are NOT Deployed:
- ❌ Username login will show: *"Unable to lookup username. Please try logging in with your email address instead."*
- ✅ Email login will work fine

### If Firestore Rules ARE Deployed:
- ✅ Both username and email login will work
- ✅ System automatically converts username → email → authenticates

---

## How to Fix Username Login

### Step 1: Deploy Firestore Rules
Follow the instructions in `FIREBASE_SETUP.md`:

1. Go to Firebase Console → Firestore Database → Rules
2. Copy contents from `firestore.rules`
3. Paste and click "Publish"
4. Wait 1-2 minutes

### Step 2: Test Login
- Try with **email first** (should always work)
- Then try with **username** (should work after rules deployed)

---

## Technical Details

### The Login Flow:

```
User enters "john123"
       ↓
Is it an email? (contains @)
  ├─ YES → Use directly
  └─ NO  → Look up in Firestore
            ↓
     Find email from username
            ↓
     Authenticate with email
```

### Why Username Lookup Needs Rules:
```javascript
// This reads from Firestore 'usernames' collection
const foundEmail = await getEmailFromUsername(username);

// Requires this rule in firestore.rules:
match /usernames/{username} {
  allow read: if true; // Anyone can read to check username
}
```

---

## Troubleshooting

### Problem: "Unable to lookup username"
**Solution:** Use your email address to login, OR deploy Firestore rules

### Problem: "Username not found"
**Solution:** 
1. Check spelling of username
2. Try using email instead
3. Verify username exists in Firestore

### Problem: "Invalid email/username or password"
**Solution:** 
1. Check your password
2. Make sure email is correct
3. Try password reset if needed

### Problem: "Database access error"
**Solution:** 
1. Deploy Firestore rules (see FIREBASE_SETUP.md)
2. Use email login temporarily
3. Wait 1-2 minutes after deploying rules

---

## Quick Reference

| Login Type | Requires Rules | Always Works |
|------------|---------------|--------------|
| Email      | No            | ✅ Yes       |
| Username   | Yes           | ⚠️ Only after rules deployed |

---

## Recommendation

**For now**: Use **email** to login until you deploy Firestore rules.

**After deploying rules**: You can use either email or username!

---

## Examples

### ✅ These Will Work (Email Login):
```
admin@example.com
john.doe@gmail.com
team1@auction.com
```

### ✅ These Will Work After Rules Deployed (Username Login):
```
admin
john123
team_alpha
```

---

**Remember**: Always deploy your Firestore rules first for full functionality!
