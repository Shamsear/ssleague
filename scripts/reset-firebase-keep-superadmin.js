/**
 * Reset Firebase Script - Keep Only Super Admin
 * 
 * This script deletes ALL data from Firebase (Firestore + Auth)
 * EXCEPT the super admin user.
 * 
 * Usage: node scripts/reset-firebase-keep-superadmin.js
 */

const admin = require('firebase-admin');
const readline = require('readline');
const path = require('path');

// Load environment variables from .env.local
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Initialize Firebase Admin
const serviceAccount = {
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const auth = admin.auth();

// Collections to delete
const COLLECTIONS_TO_DELETE = [
  'seasons',
  'teams',
  'realplayers',
  'realplayerstats',
  'teamstats',
  'bids',
  'matches',
  'fixtures',
  'invites',
  'awards',
  'footballPlayers',
  'categories',
  'import_progress',
  'usernames',
  'users', // Will handle separately to preserve super admin
];

// Function to get confirmation
function askConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// Delete all documents in a collection
async function deleteCollection(collectionName) {
  const collectionRef = db.collection(collectionName);
  const batchSize = 500;
  let deletedCount = 0;

  while (true) {
    const snapshot = await collectionRef.limit(batchSize).get();
    
    if (snapshot.empty) {
      break;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    deletedCount += snapshot.size;
    console.log(`   Deleted ${deletedCount} documents from ${collectionName}...`);
  }

  return deletedCount;
}

// Delete all users except super admin
async function deleteAllUsersExceptSuperAdmin() {
  let deletedCount = 0;
  let superAdminUid = null;
  let superAdminUsername = null;

  // First, find super admin user from Firestore
  console.log('\n🔍 Finding super admin user...');
  const usersSnapshot = await db.collection('users').where('role', '==', 'super_admin').limit(1).get();
  
  if (!usersSnapshot.empty) {
    const superAdminDoc = usersSnapshot.docs[0];
    superAdminUid = superAdminDoc.id;
    superAdminUsername = superAdminDoc.data().username;
    console.log(`✅ Found super admin: ${superAdminUsername} (${superAdminUid})`);
  } else {
    console.log('⚠️  No super admin found in Firestore. Will preserve all users with role=super_admin');
  }

  // Delete all Auth users except super admin
  console.log('\n🗑️  Deleting Firebase Auth users (except super admin)...');
  
  let nextPageToken;
  do {
    const listUsersResult = await auth.listUsers(1000, nextPageToken);
    
    for (const userRecord of listUsersResult.users) {
      // Skip super admin
      if (userRecord.uid === superAdminUid) {
        console.log(`   ⏭️  Skipping super admin: ${userRecord.email || userRecord.uid}`);
        continue;
      }

      try {
        await auth.deleteUser(userRecord.uid);
        deletedCount++;
        if (deletedCount % 10 === 0) {
          console.log(`   Deleted ${deletedCount} Auth users...`);
        }
      } catch (error) {
        console.error(`   ❌ Error deleting user ${userRecord.uid}:`, error.message);
      }
    }

    nextPageToken = listUsersResult.pageToken;
  } while (nextPageToken);

  console.log(`✅ Deleted ${deletedCount} Firebase Auth users (preserved super admin)`);

  // Delete all Firestore users except super admin
  console.log('\n🗑️  Deleting Firestore users (except super admin)...');
  let firestoreDeletedCount = 0;
  
  const usersRef = db.collection('users');
  const batch = db.batch();
  let batchCount = 0;
  
  const allUsersSnapshot = await usersRef.get();
  
  for (const doc of allUsersSnapshot.docs) {
    if (doc.id === superAdminUid) {
      console.log(`   ⏭️  Preserving super admin user doc: ${doc.id}`);
      continue;
    }
    
    batch.delete(doc.ref);
    batchCount++;
    firestoreDeletedCount++;
    
    if (batchCount >= 500) {
      await batch.commit();
      console.log(`   Deleted ${firestoreDeletedCount} Firestore user docs...`);
      batchCount = 0;
    }
  }
  
  if (batchCount > 0) {
    await batch.commit();
  }
  
  console.log(`✅ Deleted ${firestoreDeletedCount} Firestore user documents (preserved super admin)`);

  // Delete all usernames except super admin's
  console.log('\n🗑️  Deleting username entries (except super admin)...');
  let usernamesDeletedCount = 0;
  
  const usernamesRef = db.collection('usernames');
  const usernameBatch = db.batch();
  let usernameBatchCount = 0;
  
  const allUsernamesSnapshot = await usernamesRef.get();
  
  for (const doc of allUsernamesSnapshot.docs) {
    // Skip super admin's username
    if (superAdminUsername && doc.id === superAdminUsername.toLowerCase()) {
      console.log(`   ⏭️  Preserving super admin username: ${doc.id}`);
      continue;
    }
    
    // Also check if this username points to super admin UID
    const data = doc.data();
    if (data.uid === superAdminUid) {
      console.log(`   ⏭️  Preserving username that points to super admin: ${doc.id}`);
      continue;
    }
    
    usernameBatch.delete(doc.ref);
    usernameBatchCount++;
    usernamesDeletedCount++;
    
    if (usernameBatchCount >= 500) {
      await usernameBatch.commit();
      console.log(`   Deleted ${usernamesDeletedCount} username entries...`);
      usernameBatchCount = 0;
    }
  }
  
  if (usernameBatchCount > 0) {
    await usernameBatch.commit();
  }
  
  console.log(`✅ Deleted ${usernamesDeletedCount} username entries (preserved super admin)`);

  return { authDeleted: deletedCount, firestoreDeleted: firestoreDeletedCount, usernamesDeleted: usernamesDeletedCount };
}

// Main function
async function main() {
  console.log('\n⚠️  ============================================');
  console.log('⚠️  FIREBASE RESET - KEEP ONLY SUPER ADMIN');
  console.log('⚠️  ============================================\n');
  console.log('This will DELETE ALL data from Firebase:');
  console.log('  • All Firestore collections');
  console.log('  • All Firebase Auth users (except super admin)');
  console.log('  • All username entries (except super admin)\n');
  console.log('✅ PRESERVED:');
  console.log('  • Super admin user (role: super_admin)');
  console.log('  • Super admin Auth credentials');
  console.log('  • Super admin username entry\n');

  const confirmation = await askConfirmation(
    'Type "RESET FIREBASE" to confirm (anything else to cancel): '
  );

  if (confirmation !== 'RESET FIREBASE') {
    console.log('\n❌ Operation cancelled.');
    process.exit(0);
  }

  console.log('\n🚀 Starting Firebase reset...\n');

  const startTime = Date.now();
  const stats = {
    collections: {},
    totalDocuments: 0,
  };

  try {
    // Step 1: Delete all users except super admin
    const userStats = await deleteAllUsersExceptSuperAdmin();
    stats.authUsers = userStats.authDeleted;
    stats.firestoreUsers = userStats.firestoreDeleted;
    stats.usernamesDeleted = userStats.usernamesDeleted;

    // Step 2: Delete all other collections
    console.log('\n🗑️  Deleting Firestore collections...');
    
    for (const collectionName of COLLECTIONS_TO_DELETE) {
      // Skip users and usernames as we already handled them
      if (collectionName === 'users' || collectionName === 'usernames') {
        continue;
      }

      console.log(`\n📂 Deleting collection: ${collectionName}`);
      try {
        const deletedCount = await deleteCollection(collectionName);
        stats.collections[collectionName] = deletedCount;
        stats.totalDocuments += deletedCount;
        console.log(`✅ Deleted ${deletedCount} documents from ${collectionName}`);
      } catch (error) {
        console.error(`❌ Error deleting ${collectionName}:`, error.message);
        stats.collections[collectionName] = 'ERROR';
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Summary
    console.log('\n\n✅ ============================================');
    console.log('✅ FIREBASE RESET COMPLETED');
    console.log('✅ ============================================\n');
    console.log('📊 Summary:');
    console.log(`   • Auth users deleted: ${stats.authUsers}`);
    console.log(`   • Firestore user docs deleted: ${stats.firestoreUsers}`);
    console.log(`   • Username entries deleted: ${stats.usernamesDeleted}`);
    console.log(`   • Total Firestore documents deleted: ${stats.totalDocuments}`);
    console.log(`   • Collections processed: ${Object.keys(stats.collections).length}`);
    console.log(`   • Time taken: ${duration}s\n`);

    console.log('📋 Collection Details:');
    for (const [collection, count] of Object.entries(stats.collections)) {
      console.log(`   • ${collection}: ${count}`);
    }

    console.log('\n✅ Super admin preserved and ready to use!\n');

  } catch (error) {
    console.error('\n❌ Error during reset:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run the script
main();
