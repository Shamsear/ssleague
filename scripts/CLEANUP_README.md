# Database Cleanup Script

## Overview

The `clear-all-keep-superadmin.js` script provides a comprehensive way to reset your entire application to a clean state while preserving your super admin credentials.

## What Gets Deleted

### Firebase Firestore
- ✅ All collections:
  - `seasons`
  - `teams` and `teamstats`
  - `realplayers` and `realplayerstats`
  - `bids`
  - `matches` and `fixtures`
  - `invites`
  - `awards`
  - `footballPlayers`
  - `categories`
  - `import_progress`

### Firebase Auth
- ✅ All authentication users **except super admin**

### Firebase Usernames
- ✅ All username entries **except super admin's username**

### Neon PostgreSQL Database
- ✅ All data from all tables (using TRUNCATE):
  - `footballplayers`
  - `bids`
  - `rounds` / `auction_rounds`
  - `auction_settings`
  - `tiebreakers`
  - `round_players`
  - Any other custom tables

## What Gets Preserved

### Firebase
- ✅ **Super Admin User** (both in Firestore and Auth)
- ✅ **Super Admin Username**
- ✅ **Security Rules** (firestore.rules)
- ✅ **Database Indexes** (firestore.indexes.json)

### Neon
- ✅ **Table Structure** (tables are emptied, not dropped)
- ✅ **Indexes and Constraints**
- ✅ **Sequences** (reset to 1)

## Usage

### Method 1: Using npm script (Recommended)

```bash
npm run cleanup
```

### Method 2: Direct execution

```bash
node scripts/clear-all-keep-superadmin.js
```

## Safety Confirmation

The script requires you to type **`DELETE ALL DATA`** (exactly) to proceed. This prevents accidental execution.

```
❓ Are you ABSOLUTELY sure? Type "DELETE ALL DATA" to confirm: DELETE ALL DATA
```

## Requirements

### Environment Variables (in `.env.local`)

**Firebase Admin:**
```env
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=your-client-email
FIREBASE_ADMIN_PRIVATE_KEY=your-private-key
```

**Neon Database:**
```env
NEON_DATABASE_URL=postgresql://username:password@endpoint.neon.tech/dbname
```

> **Note:** If `NEON_DATABASE_URL` is not set, the script will skip Neon cleanup and only clean Firebase.

## Output Example

```
🔥 COMPREHENSIVE DATA CLEANUP SCRIPT
================================================================================

⚠️  CRITICAL WARNING: This will DELETE ALL DATA!

📋 What will be DELETED:
   ✓ Firebase: All collections (seasons, teams, players, bids, matches, etc.)
   ✓ Firebase: All Auth users except super admin
   ✓ Firebase: All usernames except super admin
   ✓ Neon: All tables (footballplayers, bids, rounds, auction settings, etc.)

📋 What will be PRESERVED:
   ✓ Firebase: Super Admin user and credentials
   ✓ Firebase: Security rules and indexes
   ✓ Neon: Table structure (tables will be emptied, not dropped)

🚀 Starting cleanup...

🔥 PART 1: FIREBASE CLEANUP

1️⃣ Identifying super admin user...
   ✅ Found super admin: admin@example.com (abc123...)
   ✅ Super admin username: admin

2️⃣ Deleting seasons collection...
   ✅ Deleted 5 documents from seasons
...

🐘 PART 2: NEON DATABASE CLEANUP

6️⃣ Fetching Neon database tables...
   ✅ Found 8 tables

7️⃣ Clearing table: footballplayers...
   ✅ Cleared 150 records from footballplayers
...

✅ CLEANUP COMPLETED SUCCESSFULLY!

📊 Summary:
   Firebase:
      - Collections cleared: 13
      - Username entries deleted: 5
      - Firestore users deleted: 10
      - Auth users deleted: 10
      - Super admin preserved: admin@example.com ✅
   Neon Database:
      - Tables cleared: 8
      - Table structure preserved ✅
```

## When to Use

- 🔄 **Starting a new season** and want to reset everything
- 🧪 **Testing** after major changes
- 🐛 **Debugging** when you need a clean state
- 📊 **Demo preparation** with fresh data
- 🗑️ **Removing test data** while keeping your admin access

## Important Notes

1. **This action is IRREVERSIBLE** - all data will be permanently deleted
2. Make sure you have backups if needed
3. The script uses `TRUNCATE` on Neon for better performance
4. Firebase collections are deleted in batches to avoid quota limits
5. The super admin is identified by `role: 'super_admin'` in Firestore

## Troubleshooting

### Script can't find super admin
- Ensure you have a user with `role: 'super_admin'` in the `users` collection
- Check that the user document ID matches the Auth UID

### Neon cleanup fails
- Verify `NEON_DATABASE_URL` is correct in `.env.local`
- Check database connection and permissions
- Tables with foreign key constraints are handled by `CASCADE`

### Firebase cleanup is slow
- This is normal for large collections
- The script uses optimized batching (250 documents at a time)
- Progress is shown every 1000 documents

## Support

If you encounter issues:
1. Check the error message in the console
2. Verify all environment variables are set correctly
3. Ensure you have necessary permissions (Firebase Admin, Neon write access)
4. Check that both services are accessible from your network
