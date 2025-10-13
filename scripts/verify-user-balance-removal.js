/**
 * Verification Script: Check balance field removal from team users
 * 
 * This script verifies that all team user documents no longer have the balance field.
 * 
 * Run with: node scripts/verify-user-balance-removal.js
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

async function verifyBalanceRemoval() {
  console.log('🔍 Verifying balance field removal from team users...\n');

  try {
    const usersSnapshot = await db.collection('users')
      .where('role', '==', 'team')
      .get();
    
    console.log(`📊 Found ${usersSnapshot.size} team user documents\n`);

    let correctCount = 0;
    let incorrectCount = 0;

    for (const doc of usersSnapshot.docs) {
      const userId = doc.id;
      const data = doc.data();
      const username = data.username || data.teamName || userId;

      console.log(`\n📝 ${username} (${userId})`);

      // Check if balance field exists
      if ('balance' in data) {
        console.log(`   ❌ FAIL: Still has balance field (value: ${data.balance})`);
        incorrectCount++;
      } else {
        console.log(`   ✅ PASS: No balance field found`);
        correctCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Verification Summary:');
    console.log('='.repeat(60));
    console.log(`✅ Correct (no balance): ${correctCount}`);
    console.log(`❌ Incorrect (has balance): ${incorrectCount}`);
    console.log(`📝 Total: ${usersSnapshot.size}`);
    console.log('='.repeat(60));

    if (incorrectCount === 0) {
      console.log('\n✨ All team users have balance field removed correctly!\n');
      console.log('💡 Budget is now managed per season in team_seasons collection.\n');
    } else {
      console.log('\n⚠️  Some team users still have the balance field!\n');
      console.log('Run the migration script again: node scripts/remove-user-balance.js\n');
    }

  } catch (error) {
    console.error('❌ Fatal error during verification:', error);
    process.exit(1);
  }
}

// Run the verification
verifyBalanceRemoval()
  .then(() => {
    console.log('👋 Exiting...');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
