/**
 * Firebase Schema Initialization for Transfer V2
 * 
 * This script:
 * 1. Adds transfer_count field to existing team_seasons documents
 * 2. Sets default value to 0 for all teams
 * 3. Creates indexes for player_transactions queries
 * 
 * Requirements: 1.1, 1.5
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
if (getApps().length === 0) {
  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}'
  );
  
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();

interface MigrationStats {
  teamSeasonsProcessed: number;
  teamSeasonsUpdated: number;
  teamSeasonsSkipped: number;
  errors: number;
  indexesCreated: number;
}

/**
 * Add transfer_count field to team_seasons documents
 */
async function addTransferCountToTeamSeasons(): Promise<{
  processed: number;
  updated: number;
  skipped: number;
  errors: number;
}> {
  console.log('\n📋 Step 1: Adding transfer_count to team_seasons documents...');
  
  const teamSeasonsRef = db.collection('team_seasons');
  const snapshot = await teamSeasonsRef.get();
  
  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  
  console.log(`   Found ${snapshot.size} team_seasons documents`);
  
  // Process in batches of 500 (Firestore batch limit)
  const batchSize = 500;
  let batch = db.batch();
  let batchCount = 0;
  
  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();
      processed++;
      
      // Check if transfer_count already exists
      if (data.transfer_count !== undefined) {
        skipped++;
        if (processed % 50 === 0) {
          console.log(`   ⏭️  Skipped ${processed}/${snapshot.size}: ${doc.id} (already has transfer_count)`);
        }
        continue;
      }
      
      // Add transfer_count field with default value 0
      batch.update(doc.ref, {
        transfer_count: 0,
        updated_at: FieldValue.serverTimestamp()
      });
      
      updated++;
      batchCount++;
      
      // Log progress every 50 documents
      if (processed % 50 === 0) {
        console.log(`   ✅ Processed ${processed}/${snapshot.size} (${updated} updated, ${skipped} skipped)`);
      }
      
      // Commit batch when it reaches the limit
      if (batchCount >= batchSize) {
        await batch.commit();
        console.log(`   💾 Committed batch of ${batchCount} updates`);
        batch = db.batch();
        batchCount = 0;
      }
    } catch (error: any) {
      errors++;
      console.error(`   ❌ Error processing ${doc.id}:`, error.message);
    }
  }
  
  // Commit remaining batch
  if (batchCount > 0) {
    await batch.commit();
    console.log(`   💾 Committed final batch of ${batchCount} updates`);
  }
  
  console.log(`\n   ✅ Completed: ${updated} updated, ${skipped} skipped, ${errors} errors`);
  
  return { processed, updated, skipped, errors };
}

/**
 * Create composite indexes for player_transactions queries
 * Note: Firestore indexes must be created via Firebase Console or firestore.indexes.json
 * This function creates the index configuration that should be added to firestore.indexes.json
 */
async function createPlayerTransactionsIndexes(): Promise<number> {
  console.log('\n📋 Step 2: Creating player_transactions indexes...');
  
  const indexConfig = {
    indexes: [
      {
        collectionGroup: 'player_transactions',
        queryScope: 'COLLECTION',
        fields: [
          { fieldPath: 'season_id', order: 'ASCENDING' },
          { fieldPath: 'created_at', order: 'DESCENDING' }
        ]
      },
      {
        collectionGroup: 'player_transactions',
        queryScope: 'COLLECTION',
        fields: [
          { fieldPath: 'season_id', order: 'ASCENDING' },
          { fieldPath: 'transaction_type', order: 'ASCENDING' },
          { fieldPath: 'created_at', order: 'DESCENDING' }
        ]
      },
      {
        collectionGroup: 'player_transactions',
        queryScope: 'COLLECTION',
        fields: [
          { fieldPath: 'old_team_id', order: 'ASCENDING' },
          { fieldPath: 'season_id', order: 'ASCENDING' },
          { fieldPath: 'created_at', order: 'DESCENDING' }
        ]
      },
      {
        collectionGroup: 'player_transactions',
        queryScope: 'COLLECTION',
        fields: [
          { fieldPath: 'new_team_id', order: 'ASCENDING' },
          { fieldPath: 'season_id', order: 'ASCENDING' },
          { fieldPath: 'created_at', order: 'DESCENDING' }
        ]
      },
      {
        collectionGroup: 'player_transactions',
        queryScope: 'COLLECTION',
        fields: [
          { fieldPath: 'team_a_id', order: 'ASCENDING' },
          { fieldPath: 'season_id', order: 'ASCENDING' },
          { fieldPath: 'created_at', order: 'DESCENDING' }
        ]
      },
      {
        collectionGroup: 'player_transactions',
        queryScope: 'COLLECTION',
        fields: [
          { fieldPath: 'team_b_id', order: 'ASCENDING' },
          { fieldPath: 'season_id', order: 'ASCENDING' },
          { fieldPath: 'created_at', order: 'DESCENDING' }
        ]
      }
    ]
  };
  
  console.log('\n   📝 Index configuration to add to firestore.indexes.json:');
  console.log(JSON.stringify(indexConfig, null, 2));
  
  console.log('\n   ℹ️  Note: Firestore indexes must be deployed using:');
  console.log('      firebase deploy --only firestore:indexes');
  console.log('\n   ℹ️  Or create them manually in Firebase Console:');
  console.log('      https://console.firebase.google.com/project/_/firestore/indexes');
  
  return indexConfig.indexes.length;
}

/**
 * Verify the migration
 */
async function verifyMigration(): Promise<boolean> {
  console.log('\n📋 Step 3: Verifying migration...');
  
  try {
    // Check a sample of team_seasons documents
    const teamSeasonsRef = db.collection('team_seasons');
    const sampleSnapshot = await teamSeasonsRef.limit(10).get();
    
    let allHaveTransferCount = true;
    let sampleCount = 0;
    
    for (const doc of sampleSnapshot.docs) {
      const data = doc.data();
      sampleCount++;
      
      if (data.transfer_count === undefined) {
        console.log(`   ❌ Document ${doc.id} missing transfer_count field`);
        allHaveTransferCount = false;
      } else {
        console.log(`   ✅ Document ${doc.id} has transfer_count: ${data.transfer_count}`);
      }
    }
    
    if (allHaveTransferCount && sampleCount > 0) {
      console.log(`\n   ✅ Verification passed: All ${sampleCount} sampled documents have transfer_count field`);
      return true;
    } else if (sampleCount === 0) {
      console.log('\n   ⚠️  No team_seasons documents found to verify');
      return true;
    } else {
      console.log('\n   ❌ Verification failed: Some documents missing transfer_count field');
      return false;
    }
  } catch (error: any) {
    console.error('\n   ❌ Verification error:', error.message);
    return false;
  }
}

/**
 * Main migration function
 */
async function runMigration() {
  console.log('🚀 Starting Transfer V2 Firebase Schema Initialization...\n');
  console.log('This script will:');
  console.log('  1. Add transfer_count field to team_seasons documents');
  console.log('  2. Generate index configuration for player_transactions');
  console.log('  3. Verify the migration\n');
  
  const stats: MigrationStats = {
    teamSeasonsProcessed: 0,
    teamSeasonsUpdated: 0,
    teamSeasonsSkipped: 0,
    errors: 0,
    indexesCreated: 0
  };
  
  try {
    // Step 1: Add transfer_count to team_seasons
    const teamSeasonsResult = await addTransferCountToTeamSeasons();
    stats.teamSeasonsProcessed = teamSeasonsResult.processed;
    stats.teamSeasonsUpdated = teamSeasonsResult.updated;
    stats.teamSeasonsSkipped = teamSeasonsResult.skipped;
    stats.errors += teamSeasonsResult.errors;
    
    // Step 2: Create indexes configuration
    stats.indexesCreated = await createPlayerTransactionsIndexes();
    
    // Step 3: Verify migration
    const verified = await verifyMigration();
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Team Seasons Processed: ${stats.teamSeasonsProcessed}`);
    console.log(`Team Seasons Updated:   ${stats.teamSeasonsUpdated}`);
    console.log(`Team Seasons Skipped:   ${stats.teamSeasonsSkipped}`);
    console.log(`Indexes Configured:     ${stats.indexesCreated}`);
    console.log(`Errors:                 ${stats.errors}`);
    console.log(`Verification:           ${verified ? '✅ PASSED' : '❌ FAILED'}`);
    console.log('='.repeat(60));
    
    if (verified && stats.errors === 0) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('\n📝 Next steps:');
      console.log('   1. Review the index configuration above');
      console.log('   2. Add the indexes to firestore.indexes.json');
      console.log('   3. Deploy indexes: firebase deploy --only firestore:indexes');
      console.log('   4. Or create them manually in Firebase Console');
      return true;
    } else {
      console.log('\n⚠️  Migration completed with warnings or errors');
      console.log('   Please review the logs above and fix any issues');
      return false;
    }
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error);
    console.error(error.stack);
    return false;
  }
}

// Run migration if called directly
if (require.main === module) {
  runMigration()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { runMigration, addTransferCountToTeamSeasons, createPlayerTransactionsIndexes, verifyMigration };
