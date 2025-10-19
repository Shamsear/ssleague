/**
 * Migration Script: Convert Old Trophy Fields to Arrays
 * 
 * This script migrates player stats from the old trophy format:
 * - individual_wise_trophy_1, individual_wise_trophy_2
 * - category_wise_trophy_1, category_wise_trophy_2
 * 
 * To the new array format:
 * - individual_trophies: string[]
 * - category_trophies: string[]
 * 
 * Usage: node scripts/migrate-trophies-to-arrays.js
 */

const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

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
    });
    console.log('✅ Firebase Admin initialized with service account\n');
  } else if (projectId) {
    admin.initializeApp({
      projectId: projectId,
    });
    console.log(`✅ Firebase Admin initialized with project ID: ${projectId}\n`);
  } else {
    admin.initializeApp();
    console.log('✅ Firebase Admin initialized with default credentials\n');
  }
}

const db = admin.firestore();

async function migrateTrophies() {
  console.log('🚀 Starting trophy migration...\n');
  
  let totalPlayers = 0;
  let migratedPlayers = 0;
  let skippedPlayers = 0;
  let errors = 0;

  try {
    // Get all seasons
    const seasonsSnapshot = await db.collection('seasons').get();
    console.log(`📊 Found ${seasonsSnapshot.size} seasons\n`);

    for (const seasonDoc of seasonsSnapshot.docs) {
      const seasonId = seasonDoc.id;
      const seasonData = seasonDoc.data();
      console.log(`\n📅 Processing Season: ${seasonData.name || seasonId}`);

      // Get all players for this season from realplayerstats
      const playersSnapshot = await db
        .collection('realplayerstats')
        .where('season_id', '==', seasonId)
        .get();

      console.log(`   👥 Found ${playersSnapshot.size} players`);
      totalPlayers += playersSnapshot.size;

      for (const playerDoc of playersSnapshot.docs) {
        const playerId = playerDoc.id;
        const playerData = playerDoc.data();

        try {
          // Check if already migrated (has new array fields)
          if (playerData.individual_trophies || playerData.category_trophies) {
            console.log(`   ⏭️  Skipped: ${playerData.name || playerId} (already migrated)`);
            skippedPlayers++;
            continue;
          }

          // Build new trophy arrays from old fields
          const individualTrophies = [];
          const categoryTrophies = [];

          // Collect individual trophies
          if (playerData.individual_wise_trophy_1 && playerData.individual_wise_trophy_1.trim()) {
            individualTrophies.push(playerData.individual_wise_trophy_1.trim());
          }
          if (playerData.individual_wise_trophy_2 && playerData.individual_wise_trophy_2.trim()) {
            individualTrophies.push(playerData.individual_wise_trophy_2.trim());
          }

          // Collect category trophies
          if (playerData.category_wise_trophy_1 && playerData.category_wise_trophy_1.trim()) {
            categoryTrophies.push(playerData.category_wise_trophy_1.trim());
          }
          if (playerData.category_wise_trophy_2 && playerData.category_wise_trophy_2.trim()) {
            categoryTrophies.push(playerData.category_wise_trophy_2.trim());
          }

          // Prepare update data
          const updateData = {
            individual_trophies: individualTrophies,
            category_trophies: categoryTrophies,
            // Remove old fields
            individual_wise_trophy_1: admin.firestore.FieldValue.delete(),
            individual_wise_trophy_2: admin.firestore.FieldValue.delete(),
            category_wise_trophy_1: admin.firestore.FieldValue.delete(),
            category_wise_trophy_2: admin.firestore.FieldValue.delete(),
          };

          // Update the player document in realplayerstats
          await db
            .collection('realplayerstats')
            .doc(playerId)
            .update(updateData);

          migratedPlayers++;
          console.log(`   ✅ Migrated: ${playerData.name || playerId}`);
          
          if (individualTrophies.length > 0) {
            console.log(`      🏆 Individual: [${individualTrophies.join(', ')}]`);
          }
          if (categoryTrophies.length > 0) {
            console.log(`      🏅 Category: [${categoryTrophies.join(', ')}]`);
          }

        } catch (error) {
          errors++;
          console.error(`   ❌ Error migrating ${playerData.name || playerId}:`, error.message);
        }
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Players:     ${totalPlayers}`);
    console.log(`✅ Migrated:       ${migratedPlayers}`);
    console.log(`⏭️  Skipped:        ${skippedPlayers}`);
    console.log(`❌ Errors:         ${errors}`);
    console.log('='.repeat(60));

    if (errors === 0) {
      console.log('\n🎉 Migration completed successfully!');
    } else {
      console.log('\n⚠️  Migration completed with some errors. Please review the logs.');
    }

  } catch (error) {
    console.error('\n❌ Fatal error during migration:', error);
    process.exit(1);
  } finally {
    // Close the app
    await admin.app().delete();
  }
}

// Run the migration
migrateTrophies()
  .then(() => {
    console.log('\n✨ Migration script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration script failed:', error);
    process.exit(1);
  });
