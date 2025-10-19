# Username Collection Fix - Team Login Issue

## The Problem

Teams couldn't login because the `usernames` collection entries weren't being created during import.

### How Login Works

1. User enters **username** and password
2. System looks up username in `usernames` collection: `usernames/{username}` → gets `uid`
3. System uses `uid` to get user details from `users` collection
4. System uses email from user document to authenticate with Firebase Auth

### What Was Missing

The import was creating:
- ✅ Firebase Auth user (email/password)
- ✅ User document in `users` collection (with username field)
- ✅ Team document in `teams` collection
- ❌ **Username entry in `usernames` collection** ← MISSING!

Without the `usernames` collection entry, the system couldn't look up the username to get the UID, so login failed.

## The Fix

### Code Changes

**File**: `app/api/seasons/historical/import/route.ts`

Added username collection entry creation:

```typescript
// CRITICAL: Create username entry in usernames collection for login
const usernameRef = adminDb.collection('usernames').doc(username.toLowerCase());
const usernameDoc = {
  uid: userUid,
  createdAt: FieldValue.serverTimestamp()
};
batch.set(usernameRef, usernameDoc);
```

This creates a document like:
```
usernames/{username_lowercase}
{
  uid: "firebase_auth_uid",
  createdAt: timestamp
}
```

### What Gets Created Now

For a team "Dragon Warriors" with owner "John Smith":

1. **Firebase Auth User**:
   - Email: `johnsmith@historical.team`
   - Password: `Dragon Warriors` (or `Dragon Warriors123` if <6 chars)
   - UID: `abc123xyz` (auto-generated)

2. **User Document** (`users/abc123xyz`):
   ```json
   {
     "uid": "abc123xyz",
     "email": "johnsmith@historical.team",
     "username": "John Smith",    ← For display
     "role": "team",
     "isActive": true,
     "isApproved": true,
     "teamName": "Dragon Warriors",
     "teamId": "SSPSLT0001"
   }
   ```

3. **Username Entry** (`usernames/john smith`):  ← **NEW!**
   ```json
   {
     "uid": "abc123xyz",
     "createdAt": timestamp
   }
   ```

4. **Team Document** (`teams/SSPSLT0001`):
   ```json
   {
     "id": "SSPSLT0001",
     "team_name": "Dragon Warriors",
     "owner_name": "John Smith",
     "userId": "abc123xyz",
     "userEmail": "johnsmith@historical.team",
     "hasUserAccount": true
   }
   ```

## Verification

### Run Verification Script

```powershell
npx ts-node scripts/verify-team-users.ts
```

This will check:
- ✅ Firebase Auth user exists
- ✅ User document in `users` collection exists
- ✅ Username field is set
- ✅ **Username entry in `usernames` collection exists** ← New check!
- ✅ Username entry points to correct UID

### Expected Output

For working teams:
```
📦 Team: Dragon Warriors (SSPSLT0001)
   ✅ UserId: abc123xyz
   ✅ Firebase Auth user exists
      - Email: johnsmith@historical.team
      - Display Name: John Smith
   ✅ Firestore user document exists
      - Username: John Smith
      - Email: johnsmith@historical.team
      - Role: team
      - isActive: true
      - isApproved: true
   ✅ Username entry exists in 'usernames' collection
      - Username: john smith
      - Points to UID: abc123xyz
   ✅ Email: johnsmith@historical.team
   ✅ All checks passed (can login)
```

For broken teams:
```
📦 Team: Dragon Warriors (SSPSLT0001)
   ✅ UserId: abc123xyz
   ✅ Firebase Auth user exists
   ✅ Firestore user document exists
      - Username: John Smith
   ❌ Username 'john smith' NOT in 'usernames' collection - LOGIN WILL FAIL!
   ⚠️  1 issue(s) found
```

## Fixing Existing Teams

### Option 1: Re-import (Recommended)

Simply re-import the season. The new code will:
- Detect it's a re-import (smart detection)
- Reuse existing Firebase Auth users
- Update user documents
- **Create missing username entries**

Steps:
1. Go to Historical Seasons import page
2. Upload the same Excel file
3. Use the same season number
4. Import proceeds with minimal reads (~128-233 reads)
5. Username entries are created automatically

### Option 2: Manual Fix in Firebase Console

For each broken team:

1. Go to Firebase Console → Firestore Database
2. Navigate to `usernames` collection
3. Click "Add Document"
4. Document ID: `username_in_lowercase` (e.g., `john smith`)
5. Add field:
   - Field: `uid`
   - Type: `string`
   - Value: (the UID from user document)
6. Add field:
   - Field: `createdAt`
   - Type: `timestamp`
   - Value: (current time)
7. Save

### Option 3: Repair Script (If Many Teams Broken)

Create a repair script:

```typescript
// scripts/repair-usernames.ts
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

async function repairUsernames() {
  const usersSnapshot = await adminDb
    .collection('users')
    .where('role', '==', 'team')
    .get();
  
  const batch = adminDb.batch();
  let count = 0;
  
  for (const userDoc of usersSnapshot.docs) {
    const userData = userDoc.data();
    const username = userData.username;
    const uid = userData.uid;
    
    if (username && uid) {
      // Check if username entry exists
      const usernameDoc = await adminDb
        .collection('usernames')
        .doc(username.toLowerCase())
        .get();
      
      if (!usernameDoc.exists) {
        // Create username entry
        const usernameRef = adminDb
          .collection('usernames')
          .doc(username.toLowerCase());
        
        batch.set(usernameRef, {
          uid: uid,
          createdAt: FieldValue.serverTimestamp()
        });
        
        count++;
        console.log(`Creating username entry: ${username.toLowerCase()} → ${uid}`);
      }
    }
  }
  
  if (count > 0) {
    await batch.commit();
    console.log(`✅ Created ${count} username entries`);
  } else {
    console.log('✅ All username entries already exist');
  }
}

repairUsernames();
```

Run with:
```powershell
npx ts-node scripts/repair-usernames.ts
```

## Testing Login

### Credentials

For team "Dragon Warriors" with owner "John Smith":
- **Username**: `John Smith` (case-insensitive, will be converted to lowercase)
- **Password**: `Dragon Warriors` (or `Dragon Warriors123` if team name <6 chars)

### Login Process

1. Enter username: `John Smith` (or `john smith`)
2. Enter password: `Dragon Warriors`
3. System converts username to lowercase
4. System looks up `usernames/john smith` → gets UID
5. System looks up `users/{UID}` → gets email
6. System authenticates with Firebase Auth using email + password
7. Login succeeds! ✅

### Troubleshooting

**"Username not found"**:
- ❌ Username entry doesn't exist in `usernames` collection
- 🔧 Fix: Re-import or manually create entry

**"Invalid password"**:
- ❌ Wrong password or Firebase Auth user doesn't exist
- 🔧 Fix: Try password variations (team name, with "123", etc.)

**"User not active" or "User not approved"**:
- ❌ User document has `isActive: false` or `isApproved: false`
- 🔧 Fix: Update user document in Firestore

## Summary

✅ **Fixed**: Import now creates username entries in `usernames` collection
✅ **Verified**: New verification script checks all login requirements
✅ **Backward Compatible**: Existing imports can be fixed by re-importing

Teams can now login successfully! 🎉
