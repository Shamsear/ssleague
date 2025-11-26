/**
 * Migration Script: Add transfer_count field to team_seasons collection
 * 
 * This script adds the transfer_count field to all existing team_seasons documents
 * in Firebase Firestore. The field tracks the number of transfers, swaps, and releases
 * a team has performed in a season (max 2 per season).
 * 
 * Requirements: 1.1
 */

const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin
if (!admin.apps.length) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  
  if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || `https://${process.env.FIREBASE_ADMIN_PROJECT_ID}-default-rtdb.firebaseio.com`,
    });
  } else if (projectId) {
    admin.initializeApp({
      projectId: projectId,
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || `https://${projectId}-default-rtdb.firebaseio.com`,
    });
  } else {
    admin.initializeApp();
  }
}

const db = admin.firestore();

/**
 * Add transfer_count field to all team_seasons documents
 */
async function addTransferCountField() {
  try {
    console.log('🚀 Starting migration: Add transfer_count to team_seasons\n');
    console.log('════════════════════════════════════════════════════════\n');

    // Fetch all team_seasons documents
    console.log('📋 Fetching team_seasons documents...');
    const teamSeasonsSnapshot = await db.collection('team_seasons').get();
    console.log(`📊 Found ${teamSeasonsSnapshot.size} team_seasons documents\n`);

    if (teamSeasonsSnapshot.empty) {
      console.log('✅ No team_seasons documents found. Migration complete.\n');
      return;
    }

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Process each document
    for (const doc of teamSeasonsSnapshot.docs) {
      const docId = doc.id;
      const data = doc.data();

      try {
        // Check if transfer_count already exists
        if (data.transfer_count !== undefined) {
          console.log(`⏭️  ${docId}: transfer_count already exists (${data.transfer_count}), skipping`);
          skippedCount++;
          continue;
        }

        // Add transfer_count field with default value 0
        await doc.ref.update({
          transfer_count: 0,
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`✅ ${docId}: Added transfer_count = 0`);
        updatedCount++;

      } catch (error) {
        console.error(`❌ ${docId}: Error updating document:`, error.message);
        errorCount++;
      }
    }

    // Summary
    console.log('\n════════════════════════════════════════════════════════');
    console.log('📊 Migration Summary:');
    console.log(`   ✅ Updated: ${updatedCount} documents`);
    console.log(`   ⏭️  Skipped: ${skippedCount} documents (already had field)`);
    console.log(`   ❌ Errors: ${errorCount} documents`);
    console.log('════════════════════════════════════════════════════════\n');

    if (errorCount > 0) {
      console.log('⚠️  Some documents failed to update. Please review errors above.\n');
    } else {
      console.log('✅ Migration completed successfully!\n');
    }

    // Create composite index recommendation
    console.log('📝 Index Recommendation:');
    console.log('   Firestore automatically indexes single fields.');
    console.log('   For efficient queries by team_id and season_id, ensure you have');
    console.log('   composite indexes if needed. Check Firebase Console > Firestore > Indexes.\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration
addTransferCountField()
  .then(() => {
    console.log('🎉 Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
