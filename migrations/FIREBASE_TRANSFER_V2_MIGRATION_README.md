# Firebase Transfer V2 Migration Guide

This migration adds support for the enhanced player transfer and swap system by initializing Firebase Firestore schema.

## What This Migration Does

### Updates to `team_seasons` collection:
- Adds `transfer_count` field (INTEGER, default: 0) to track transfers/swaps/releases per team per season
- Updates all existing documents with the default value

### Creates Firestore Indexes for `player_transactions` collection:
- `season_id + created_at`: For querying all transactions in a season
- `season_id + transaction_type + created_at`: For filtering by transaction type
- `old_team_id + season_id + created_at`: For querying transfers from a team
- `new_team_id + season_id + created_at`: For querying transfers to a team
- `team_a_id + season_id + created_at`: For querying swaps involving team A
- `team_b_id + season_id + created_at`: For querying swaps involving team B

## Prerequisites

- Firebase Admin SDK configured
- Service account key in `.env.local` as `FIREBASE_SERVICE_ACCOUNT_KEY`
- Node.js and TypeScript installed
- Firebase CLI installed (for deploying indexes)

## Running the Migration

### Step 1: Install Dependencies

```bash
npm install firebase-admin dotenv
```

### Step 2: Run the Migration Script

```bash
# Using ts-node
npx ts-node scripts/init-transfer-v2-firebase.ts

# Or compile and run
npx tsc scripts/init-transfer-v2-firebase.ts
node scripts/init-transfer-v2-firebase.js
```

### Step 3: Deploy Firestore Indexes

The script will output the index configuration. You have two options:

#### Option A: Add to firestore.indexes.json and Deploy

1. Copy the indexes from `migrations/firestore_indexes_transfer_v2.json`
2. Add them to your `firestore.indexes.json` file (merge with existing indexes)
3. Deploy using Firebase CLI:

```bash
firebase deploy --only firestore:indexes
```

#### Option B: Create Manually in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Navigate to Firestore Database → Indexes
4. Click "Create Index" for each index configuration shown in the script output

## Expected Output

```
🚀 Starting Transfer V2 Firebase Schema Initialization...

This script will:
  1. Add transfer_count field to team_seasons documents
  2. Generate index configuration for player_transactions
  3. Verify the migration

📋 Step 1: Adding transfer_count to team_seasons documents...
   Found 25 team_seasons documents
   ✅ Processed 25/25 (25 updated, 0 skipped)
   💾 Committed final batch of 25 updates

   ✅ Completed: 25 updated, 0 skipped, 0 errors

📋 Step 2: Creating player_transactions indexes...

   📝 Index configuration to add to firestore.indexes.json:
   {
     "indexes": [
       {
         "collectionGroup": "player_transactions",
         "queryScope": "COLLECTION",
         "fields": [
           { "fieldPath": "season_id", "order": "ASCENDING" },
           { "fieldPath": "created_at", "order": "DESCENDING" }
         ]
       },
       ...
     ]
   }

   ℹ️  Note: Firestore indexes must be deployed using:
      firebase deploy --only firestore:indexes

   ℹ️  Or create them manually in Firebase Console:
      https://console.firebase.google.com/project/_/firestore/indexes

📋 Step 3: Verifying migration...
   ✅ Document team0001_season001 has transfer_count: 0
   ✅ Document team0002_season001 has transfer_count: 0
   ...

   ✅ Verification passed: All 10 sampled documents have transfer_count field

============================================================
📊 MIGRATION SUMMARY
============================================================
Team Seasons Processed: 25
Team Seasons Updated:   25
Team Seasons Skipped:   0
Indexes Configured:     6
Errors:                 0
Verification:           ✅ PASSED
============================================================

🎉 Migration completed successfully!

📝 Next steps:
   1. Review the index configuration above
   2. Add the indexes to firestore.indexes.json
   3. Deploy indexes: firebase deploy --only firestore:indexes
   4. Or create them manually in Firebase Console
```

## Verification

### Manual Verification in Firebase Console

1. Go to Firestore Database
2. Open the `team_seasons` collection
3. Check a few documents to verify they have the `transfer_count` field set to 0
4. Go to Indexes tab and verify the new indexes are being built

### Verification Queries (using Firebase Admin SDK)

```typescript
import { getFirestore } from 'firebase-admin/firestore';

const db = getFirestore();

// Check team_seasons have transfer_count
const teamSeasons = await db.collection('team_seasons').limit(5).get();
teamSeasons.forEach(doc => {
  const data = doc.data();
  console.log(`${doc.id}: transfer_count = ${data.transfer_count}`);
});

// Test player_transactions query (will fail if indexes not deployed)
const transactions = await db.collection('player_transactions')
  .where('season_id', '==', 'season001')
  .orderBy('created_at', 'desc')
  .limit(10)
  .get();
console.log(`Found ${transactions.size} transactions`);
```

## Rollback (if needed)

If you need to rollback the migration:

```typescript
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const db = getFirestore();

async function rollback() {
  const teamSeasonsRef = db.collection('team_seasons');
  const snapshot = await teamSeasonsRef.get();
  
  const batch = db.batch();
  let count = 0;
  
  for (const doc of snapshot.docs) {
    batch.update(doc.ref, {
      transfer_count: FieldValue.delete()
    });
    count++;
    
    if (count >= 500) {
      await batch.commit();
      count = 0;
    }
  }
  
  if (count > 0) {
    await batch.commit();
  }
  
  console.log('Rollback complete');
}

rollback();
```

For indexes, you can delete them from Firebase Console or remove them from `firestore.indexes.json` and redeploy.

## Troubleshooting

### Error: "Service account key not found"

Make sure your `.env.local` file has the `FIREBASE_SERVICE_ACCOUNT_KEY` variable set:

```bash
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...",...}'
```

### Error: "Permission denied"

Ensure your service account has the following roles:
- Cloud Datastore User
- Firebase Admin

### Error: "Index already exists"

This is safe to ignore. Firestore will skip creating duplicate indexes.

### Script hangs or times out

If you have a large number of documents:
1. The script processes in batches of 500
2. You may need to increase Node.js memory: `node --max-old-space-size=4096 script.js`
3. Consider running during off-peak hours

### Indexes take long to build

Firestore indexes can take several minutes to hours to build depending on:
- Number of documents in the collection
- Complexity of the index
- Current Firebase load

You can monitor index build progress in Firebase Console → Firestore → Indexes.

## Testing After Migration

After the migration is complete, test the transfer system:

1. **Test transfer limit tracking:**
```typescript
// Should return { transfersUsed: 0, transfersRemaining: 2, canTransfer: true }
const status = await getTransferLimitStatus('team0001', 'season001');
```

2. **Test transaction queries:**
```typescript
// Should return all transactions for a season
const transactions = await db.collection('player_transactions')
  .where('season_id', '==', 'season001')
  .orderBy('created_at', 'desc')
  .get();
```

3. **Test team queries:**
```typescript
// Should include transfer_count field
const team = await db.collection('team_seasons')
  .doc('team0001_season001')
  .get();
console.log(team.data()?.transfer_count); // Should be 0
```

## Related Files

- Migration Script: `scripts/init-transfer-v2-firebase.ts`
- Index Configuration: `migrations/firestore_indexes_transfer_v2.json`
- Main Indexes File: `firestore.indexes.json`
- Requirements: `.kiro/specs/player-transfer-window/requirements.md`
- Design: `.kiro/specs/player-transfer-window/design.md`
- Tasks: `.kiro/specs/player-transfer-window/tasks.md`

## Next Steps

After successful migration:

1. ✅ Verify all team_seasons have transfer_count field
2. ✅ Deploy Firestore indexes
3. ✅ Wait for indexes to finish building
4. ✅ Test transfer limit queries
5. ✅ Implement transfer and swap API endpoints
6. ✅ Build UI components

## Support

If you encounter issues:
1. Check the script output for specific error messages
2. Verify Firebase Admin SDK is properly configured
3. Check Firebase Console for any quota or permission issues
4. Review Firestore security rules if queries fail
5. Ensure indexes are fully built before testing queries
