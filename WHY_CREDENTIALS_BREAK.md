# Why Firebase Admin Credentials Might Appear to "Break"

## Investigation Results

Based on the analysis, here are the **most likely reasons** you needed to regenerate credentials:

## 1. ❌ **Dev Server Not Restarted After Changes**

**Most Common Cause!**

When you update `.env.local`, Node.js doesn't automatically reload environment variables. The dev server caches the old credentials in memory.

**Solution:**
```bash
# Always restart dev server after changing .env.local
Get-Process | Where-Object {$_.ProcessName -like "*node*"} | Stop-Process -Force
npm run dev
```

## 2. 🔄 **Multiple Projects Using Same Credentials**

You switched from project `eague-92e4f` to `eaguedemo` on Oct 3, 2025.

**What might have happened:**
- Old credentials from `eague-92e4f` were being used
- You switched Firebase projects but kept old admin SDK credentials
- The credentials were valid for the wrong project

**Check:** Your backup file shows you were using `eague-92e4f` before, but now using `eaguedemo`.

## 3. 📝 **Credentials Format Issues**

Service account keys are sensitive to formatting:

**Common Issues:**
- Extra spaces before/after the key
- Newlines not properly escaped as `\n`
- Missing quotes around the private key
- Windows line endings (`\r\n`) vs Unix (`\n`)

**Correct Format:**
```bash
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"
```

## 4. 🔐 **Firestore Rules Changed**

If someone updated Firestore security rules to be more restrictive, the service account might need additional permissions.

**Check in Firebase Console:**
```
Firestore Database → Rules
```

Make sure there's a rule allowing service account access:
```javascript
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 5. 🎯 **IAM Permissions Revoked**

Someone might have accidentally changed the service account's IAM permissions.

**Check in Google Cloud Console:**
1. Go to: https://console.cloud.google.com/iam-admin/iam
2. Find: `firebase-adminsdk-fbsvc@eaguedemo.iam.gserviceaccount.com`
3. Verify it has one of these roles:
   - Firebase Admin SDK Administrator Service Agent
   - Cloud Datastore User
   - Editor (or Owner)

## 6. 💾 **Git Accidentally Overwrote .env.local**

If `.env.local` was committed to git (it shouldn't be!), pulling changes might overwrite it.

**Verify `.env.local` is in `.gitignore`:**
```bash
Get-Content .gitignore | Select-String "env.local"
```

## 7. 🔄 **Hot Reload Issues**

Next.js hot reload doesn't always pick up environment variable changes properly.

**Best Practice:**
- Stop the dev server completely (not just Ctrl+C)
- Kill all Node processes
- Start fresh

## How to Prevent This Issue

### ✅ **Quick Fix Checklist:**

1. **After any `.env.local` change:**
   ```bash
   # Kill all node processes
   Get-Process | Where-Object {$_.ProcessName -like "*node*"} | Stop-Process -Force
   
   # Start fresh
   npm run dev
   ```

2. **Verify credentials are loaded:**
   ```bash
   node -e "require('dotenv').config({path:'.env.local'}); console.log('Project:', process.env.FIREBASE_ADMIN_PROJECT_ID)"
   ```

3. **Test before running app:**
   ```bash
   node test-firebase-admin.js  # (if you still have this file)
   ```

### 🛡️ **Long-term Prevention:**

1. **Create a startup script** that always loads fresh:
   ```json
   // package.json
   {
     "scripts": {
       "dev:fresh": "taskkill /F /IM node.exe 2>nul & npm run dev"
     }
   }
   ```

2. **Version control your .env.example:**
   - Keep `.env.local.example` with dummy values
   - Real `.env.local` should be in `.gitignore`

3. **Document the setup:**
   - Keep a README with credential regeneration steps
   - Store backup of working `.env.local` in a secure location

## Most Likely Cause in Your Case

**Before:** You had credentials from the OLD project (`eague-92e4f`)
**Oct 3:** Switched to NEW project (`eaguedemo`) 
**Issue:** Old credentials were still in `.env.local` trying to access new project

The credentials weren't "breaking" - they were just for the wrong Firebase project!

## Current Status

✅ You now have correct credentials for `eaguedemo`
✅ Dev server restarted with fresh environment
✅ Firestore access confirmed working

**These credentials should keep working indefinitely** unless:
- Someone manually revokes the service account key
- IAM permissions are changed
- You switch Firebase projects again

## If It Happens Again

1. **First, try restarting dev server** (99% of the time this fixes it)
2. Check if project ID matches: `eaguedemo`
3. Only generate new key if restart doesn't work

## Questions to Ask

- [ ] Did you restart the dev server after the last credential update?
- [ ] Are there multiple team members potentially changing credentials?
- [ ] Did you switch between Firebase projects recently?
- [ ] Are credentials stored somewhere else that might be overwriting `.env.local`?
