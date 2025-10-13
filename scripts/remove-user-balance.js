/**
 * Migration Script: Remove balance field from team user documents
 * 
 * This script removes the deprecated balance field from all team user documents.
 * Budget/balance is now managed per season in the team_seasons collection.
 * 
 * Run with: node scripts/remove-user-balance.js
 */

const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
    
    if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
      console.log('✅ Firebase Admin initialized\n');
    } else if (projectId) {
      admin.initializeApp({
        projectId: projectId,
      });
      console.log(`✅ Firebase Admin initialized with project ID: ${projectId}\n`);
    } else {
      admin.initializeApp();
      console.log('✅ Firebase Admin initialized\n');
    }
  } catch (error) {
    console.error('❌ Firebase admin initialization error:', error);
    process.exit(1);
  }
}

const db = admin.firestore();

async function removeBalanceFromUsers() {
  console.log('🚀 Starting removal of balance field from team users...\n');

  try {
    // Get all team user documents
    const usersSnapshot = await db.collection('users')
      .where('role', '==', 'team')
      .get();
    
    console.log(`📊 Found ${usersSnapshot.size} team user documents\n`);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (const doc of usersSnapshot.docs) {
      const userId = doc.id;
      const data = doc.data();
      const username = data.username || data.teamName || userId;

      console.log(`\n📝 Processing: ${username} (${userId})`);

      try {
        // Check if balance field exists
        if ('balance' in data) {
          const balanceValue = data.balance;
          console.log(`   💰 Current balance value: ${balanceValue}`);
          console.log(`   🔄 Removing balance field...`);

          // Remove the balance field using FieldValue.delete()
          await doc.ref.update({
            balance: admin.firestore.FieldValue.delete(),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
          });

          console.log(`   ✅ Successfully removed balance field from ${username}`);
          successCount++;
        } else {
          console.log(`   ⏭️  No balance field found, skipping...`);
          skippedCount++;
        }

      } catch (error) {
        console.error(`   ❌ Error processing ${username}:`, error);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log('='.repeat(60));
    console.log(`✅ Successfully updated: ${successCount}`);
    console.log(`⏭️  Skipped (no balance field): ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📝 Total processed: ${usersSnapshot.size}`);
    console.log('='.repeat(60));

    if (successCount > 0) {
      console.log('\n✨ Balance field successfully removed from team users!');
      console.log('💡 Budget is now managed per season in team_seasons collection.\n');
    } else if (skippedCount === usersSnapshot.size) {
      console.log('\n✅ All team users already have balance field removed!\n');
    }

  } catch (error) {
    console.error('❌ Fatal error during migration:', error);
    process.exit(1);
  }
}

// Run the migration
removeBalanceFromUsers()
  .then(() => {
    console.log('👋 Exiting...');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
