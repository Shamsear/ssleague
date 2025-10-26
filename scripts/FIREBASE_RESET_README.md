# Firebase Reset Script - Keep Super Admin Only

## Overview

This script completely resets your Firebase database and authentication, preserving ONLY the super admin user.

## What Gets Deleted

### Firebase Authentication
- ✅ All users EXCEPT super admin
- ✅ All login credentials EXCEPT super admin

### Firestore Collections
- ✅ `seasons` - All season data
- ✅ `teams` - All team documents
- ✅ `realplayers` - All player master data
- ✅ `realplayerstats` - All player statistics
- ✅ `teamstats` - All team statistics
- ✅ `bids` - All auction bids
- ✅ `matches` - All match records
- ✅ `fixtures` - All fixtures
- ✅ `invites` - All admin invites
- ✅ `awards` - All awards/trophies
- ✅ `footballPlayers` - All football player database
- ✅ `categories` - All categories
- ✅ `import_progress` - All import progress
- ✅ `usernames` - All username mappings EXCEPT super admin
- ✅ `users` - All user documents EXCEPT super admin

## What Is Preserved

### Super Admin User
- ✅ Firebase Auth account (can still login)
- ✅ Firestore user document (role: super_admin)
- ✅ Username mapping in `usernames` collection
- ✅ All super admin credentials and permissions

## Usage

### Prerequisites

Make sure you have these environment variables in `.env.local`:

```env
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=your-service-account@...
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
```

### Run the Script

```bash
node scripts/reset-firebase-keep-superadmin.js
```

### Confirmation Required

The script will ask you to type:
```
RESET FIREBASE
```

This is a safety measure to prevent accidental deletions.

## Example Output

```
⚠️  ============================================
⚠️  FIREBASE RESET - KEEP ONLY SUPER ADMIN
⚠️  ============================================

This will DELETE ALL data from Firebase:
  • All Firestore collections
  • All Firebase Auth users (except super admin)
  • All username entries (except super admin)

✅ PRESERVED:
  • Super admin user (role: super_admin)
  • Super admin Auth credentials
  • Super admin username entry

Type "RESET FIREBASE" to confirm (anything else to cancel): RESET FIREBASE

🚀 Starting Firebase reset...

🔍 Finding super admin user...
✅ Found super admin: admin (abc123uid)

🗑️  Deleting Firebase Auth users (except super admin)...
   ⏭️  Skipping super admin: admin@example.com
   Deleted 10 Auth users...
   Deleted 20 Auth users...
✅ Deleted 25 Firebase Auth users (preserved super admin)

🗑️  Deleting Firestore users (except super admin)...
   ⏭️  Preserving super admin user doc: abc123uid
✅ Deleted 25 Firestore user documents (preserved super admin)

🗑️  Deleting username entries (except super admin)...
   ⏭️  Preserving super admin username: admin
✅ Deleted 25 username entries (preserved super admin)

🗑️  Deleting Firestore collections...

📂 Deleting collection: seasons
   Deleted 500 documents from seasons...
   Deleted 1000 documents from seasons...
✅ Deleted 1234 documents from seasons

... (more collections)

✅ ============================================
✅ FIREBASE RESET COMPLETED
✅ ============================================

📊 Summary:
   • Auth users deleted: 25
   • Firestore user docs deleted: 25
   • Username entries deleted: 25
   • Total Firestore documents deleted: 5678
   • Collections processed: 12
   • Time taken: 45.32s

📋 Collection Details:
   • seasons: 1234
   • teams: 789
   • realplayers: 456
   ... (more)

✅ Super admin preserved and ready to use!
```

## After Reset

### What You Can Do

1. **Login as Super Admin** - Your super admin credentials still work
2. **Create New Season** - Start fresh with a new season
3. **Import Historical Data** - Import historical seasons
4. **Create New Teams** - Register new teams
5. **Create Admin Invites** - Invite new committee admins

### What's Different

- All historical data is gone
- All teams and players are gone
- All matches and fixtures are gone
- Clean slate for testing or fresh start

## Safety Features

1. **Confirmation Required** - Must type exact phrase
2. **Super Admin Detection** - Automatically finds and preserves super admin
3. **Batch Processing** - Handles large datasets efficiently
4. **Error Handling** - Continues even if individual operations fail
5. **Detailed Logging** - Shows exactly what's being deleted

## Warning

⚠️ **THIS ACTION IS IRREVERSIBLE!**

Once you run this script and confirm:
- All data except super admin is **PERMANENTLY DELETED**
- There is **NO UNDO**
- Backups are your only recovery option

**Always backup your Firebase database before running this script!**

## Alternative: Full Cleanup (Including Neon)

If you also want to clear Neon database, use:
```bash
npm run cleanup
```

This runs the `clear-all-keep-superadmin.js` script which clears both Firebase AND Neon.

## Troubleshooting

### "No super admin found"
- Make sure you have a user with `role: 'super_admin'` in Firestore
- Check your Firebase Admin credentials

### "Permission denied"
- Verify your service account has admin permissions
- Check `.env.local` environment variables

### "Collection not found"
- This is normal if the collection doesn't exist
- Script will skip and continue

### Script hangs
- Large datasets take time (expect 1-3 minutes per 1000 documents)
- Check network connection
- Verify Firebase Admin SDK is initialized correctly

## Support

If you encounter issues:
1. Check the console output for specific errors
2. Verify environment variables are set correctly
3. Ensure Firebase Admin SDK has proper permissions
4. Check Firebase console for any quota limits
