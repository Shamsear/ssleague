/**
 * Migration Script: Remove Duplicate Stats Fields
 * 
 * This script removes the nested 'stats' object from realplayerstats documents
 * where stats are duplicated both at root level and in a nested 'stats' map.
 * 
 * Usage: npx tsx scripts/migrate-remove-duplicate-stats.ts
 */

import { adminDb } from '../lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

const db = adminDb;

async function migrateDuplicateStats() {
  console.log('🚀 Starting migration to remove duplicate stats fields...\n');

  try {
    // Fetch all realplayerstats documents
    const statsSnapshot = await db.collection('realplayerstats').get();
    
    console.log(`📊 Found ${statsSnapshot.size} player stats documents to check\n`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Process in batches of 500 (Firestore batch limit)
    const batchSize = 500;
    let currentBatch = db.batch();
    let batchCount = 0;

    for (const doc of statsSnapshot.docs) {
      try {
        const data = doc.data();
        
        // Check if document has the nested 'stats' field
        if (data.stats && typeof data.stats === 'object') {
          console.log(`  🔄 Removing nested stats from: ${data.player_name || doc.id}`);
          
          // Remove the nested 'stats' field
          currentBatch.update(doc.ref, {
            stats: FieldValue.delete()
          });
          
          batchCount++;
          updatedCount++;

          // Commit batch if we've reached the limit
          if (batchCount >= batchSize) {
            await currentBatch.commit();
            console.log(`  ✅ Committed batch of ${batchCount} updates\n`);
            currentBatch = db.batch();
            batchCount = 0;
          }
        } else {
          skippedCount++;
        }
      } catch (error: any) {
        console.error(`  ❌ Error processing document ${doc.id}:`, error.message);
        errorCount++;
      }
    }

    // Commit any remaining updates
    if (batchCount > 0) {
      await currentBatch.commit();
      console.log(`  ✅ Committed final batch of ${batchCount} updates\n`);
    }

    console.log('✅ Migration completed successfully!\n');
    console.log('📈 Summary:');
    console.log(`  - Documents updated: ${updatedCount}`);
    console.log(`  - Documents skipped (no nested stats): ${skippedCount}`);
    console.log(`  - Errors: ${errorCount}`);
    console.log(`  - Total documents processed: ${statsSnapshot.size}\n`);

  } catch (error: any) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration
migrateDuplicateStats()
  .then(() => {
    console.log('🎉 Migration script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration script failed:', error);
    process.exit(1);
  });
