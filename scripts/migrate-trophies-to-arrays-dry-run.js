/**
 * Migration Script (DRY RUN): Preview Trophy Migration
 * 
 * This script PREVIEWS what will be migrated without making any changes.
 * It shows you what the old trophy fields will be converted to.
 * 
 * Usage: node scripts/migrate-trophies-to-arrays-dry-run.js
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

async function previewMigration() {
  console.log('👀 DRY RUN - Preview Trophy Migration\n');
  console.log('⚠️  NO CHANGES WILL BE MADE TO THE DATABASE\n');
  
  let totalPlayers = 0;
  let needsMigration = 0;
  let alreadyMigrated = 0;

  try {
    // Get all seasons
    const seasonsSnapshot = await db.collection('seasons').get();
    console.log(`📊 Found ${seasonsSnapshot.size} seasons\n`);

    for (const seasonDoc of seasonsSnapshot.docs) {
      const seasonId = seasonDoc.id;
      const seasonData = seasonDoc.data();
      console.log(`\n📅 Season: ${seasonData.name || seasonId}`);

      // Get all players for this season from realplayerstats
      const playersSnapshot = await db
        .collection('realplayerstats')
        .where('season_id', '==', seasonId)
        .get();

      console.log(`   👥 ${playersSnapshot.size} players`);
      totalPlayers += playersSnapshot.size;

      for (const playerDoc of playersSnapshot.docs) {
        const playerData = playerDoc.data();

        // Check if already migrated
        if (playerData.individual_trophies || playerData.category_trophies) {
          alreadyMigrated++;
          continue;
        }

        // Check if has old trophy fields
        const hasOldFields = 
          playerData.individual_wise_trophy_1 ||
          playerData.individual_wise_trophy_2 ||
          playerData.category_wise_trophy_1 ||
          playerData.category_wise_trophy_2;

        if (!hasOldFields) {
          continue; // No trophies at all
        }

        needsMigration++;

        // Build preview
        const individualTrophies = [];
        const categoryTrophies = [];

        if (playerData.individual_wise_trophy_1 && playerData.individual_wise_trophy_1.trim()) {
          individualTrophies.push(playerData.individual_wise_trophy_1.trim());
        }
        if (playerData.individual_wise_trophy_2 && playerData.individual_wise_trophy_2.trim()) {
          individualTrophies.push(playerData.individual_wise_trophy_2.trim());
        }

        if (playerData.category_wise_trophy_1 && playerData.category_wise_trophy_1.trim()) {
          categoryTrophies.push(playerData.category_wise_trophy_1.trim());
        }
        if (playerData.category_wise_trophy_2 && playerData.category_wise_trophy_2.trim()) {
          categoryTrophies.push(playerData.category_wise_trophy_2.trim());
        }

        console.log(`\n   📝 ${playerData.name || 'Unknown'}`);
        console.log(`      OLD FORMAT:`);
        console.log(`        individual_wise_trophy_1: "${playerData.individual_wise_trophy_1 || 'null'}"`);
        console.log(`        individual_wise_trophy_2: "${playerData.individual_wise_trophy_2 || 'null'}"`);
        console.log(`        category_wise_trophy_1: "${playerData.category_wise_trophy_1 || 'null'}"`);
        console.log(`        category_wise_trophy_2: "${playerData.category_wise_trophy_2 || 'null'}"`);
        console.log(`      NEW FORMAT:`);
        console.log(`        individual_trophies: [${individualTrophies.map(t => `"${t}"`).join(', ')}]`);
        console.log(`        category_trophies: [${categoryTrophies.map(t => `"${t}"`).join(', ')}]`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 DRY RUN SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Players:           ${totalPlayers}`);
    console.log(`✅ Already Migrated:     ${alreadyMigrated}`);
    console.log(`🔄 Needs Migration:      ${needsMigration}`);
    console.log('='.repeat(60));

    if (needsMigration > 0) {
      console.log('\n💡 To apply these changes, run:');
      console.log('   node scripts/migrate-trophies-to-arrays.js');
    } else {
      console.log('\n✨ All players are already migrated or have no trophies!');
    }

  } catch (error) {
    console.error('\n❌ Error during preview:', error);
    process.exit(1);
  } finally {
    await admin.app().delete();
  }
}

// Run the preview
previewMigration()
  .then(() => {
    console.log('\n✨ Preview finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Preview failed:', error);
    process.exit(1);
  });
