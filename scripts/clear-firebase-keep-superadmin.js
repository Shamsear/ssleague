const admin = require('firebase-admin');
const readline = require('readline');
const path = require('path');

// Load .env.local file
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Initialize Firebase Admin
if (!admin.apps.length) {
  if (process.env.FIREBASE_ADMIN_PROJECT_ID && 
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL && 
      process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    // Use environment variables
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
      })
    });
    console.log('✅ Firebase Admin initialized with environment credentials');
  } else {
    console.error('❌ Error: Firebase Admin credentials not found in environment variables!');
    console.error('Please set the following in your .env.local file:');
    console.error('  - FIREBASE_ADMIN_PROJECT_ID');
    console.error('  - FIREBASE_ADMIN_CLIENT_EMAIL');
    console.error('  - FIREBASE_ADMIN_PRIVATE_KEY');
    process.exit(1);
  }
}

const db = admin.firestore();
const auth = admin.auth();

// Create readline interface for confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function clearFirebase() {
  console.log('\n🔥 Firebase Cleanup Script\n');
  console.log('⚠️  WARNING: This will DELETE all data except super admin!\n');
  console.log('📋 Data to be deleted:');
  console.log('   - All seasons');
  console.log('   - All teams (and their Auth users)');
  console.log('   - All players (realplayers & realplayerstats)');
  console.log('   - All bids');
  console.log('   - All matches');
  console.log('   - All invites');
  console.log('   - All usernames (except super admin)');
  console.log('   - All users except super_admin\n');

  return new Promise((resolve) => {
    rl.question('❓ Are you ABSOLUTELY sure? Type "DELETE ALL" to confirm: ', async (answer) => {
      rl.close();
      
      if (answer !== 'DELETE ALL') {
        console.log('\n❌ Cancelled. No data was deleted.');
        resolve(false);
        return;
      }

      console.log('\n🚀 Starting cleanup...\n');

      try {
        // Step 1: Get super admin user and username
        console.log('1️⃣ Identifying super admin user...');
        const usersSnapshot = await db.collection('users')
          .where('role', '==', 'super_admin')
          .limit(1)
          .get();

        let superAdminUid = null;
        let superAdminUsername = null;
        if (!usersSnapshot.empty) {
          superAdminUid = usersSnapshot.docs[0].id;
          const superAdminData = usersSnapshot.docs[0].data();
          superAdminUsername = superAdminData.username ? superAdminData.username.toLowerCase() : null;
          console.log(`   ✅ Found super admin: ${superAdminData.email} (${superAdminUid})`);
          if (superAdminUsername) {
            console.log(`   ✅ Super admin username: ${superAdminUsername}\n`);
          } else {
            console.log('   ⚠️  Super admin has no username field!\n');
          }
        } else {
          console.log('   ⚠️  No super admin found in Firestore!\n');
        }

        // Step 2: Delete collections
        const collections = [
          'seasons',
          'teams',
          'teamstats',  // NEW: Team stats collection
          'realplayers',
          'realplayerstats',
          'bids',
          'matches',
          'invites',
          'awards',  // Added awards collection
          'footballPlayers'
        ];

        for (const collectionName of collections) {
          console.log(`2️⃣ Deleting ${collectionName} collection...`);
          const deleteCount = await deleteCollection(db, collectionName, 250); // Smaller batch for efficiency
          console.log(`   ✅ Deleted ${deleteCount} documents from ${collectionName}\n`);
        }

        // Step 2.5: Delete all usernames except super admin
        console.log('2️⃣.5️⃣ Deleting usernames collection (except super admin)...');
        const allUsernamesSnapshot = await db.collection('usernames').get();
        let deletedUsernamesCount = 0;
        
        const usernameBatch = db.batch();
        allUsernamesSnapshot.docs.forEach((doc) => {
          // Keep super admin username if it exists
          if (superAdminUsername && doc.id === superAdminUsername) {
            console.log(`   🔒 Keeping super admin username: ${doc.id}`);
          } else {
            usernameBatch.delete(doc.ref);
            deletedUsernamesCount++;
          }
        });
        
        if (deletedUsernamesCount > 0) {
          await usernameBatch.commit();
        }
        console.log(`   ✅ Deleted ${deletedUsernamesCount} username entries\n`);

        // Step 3: Delete all users except super admin
        console.log('3️⃣ Deleting users from Firestore (except super admin)...');
        const allUsersSnapshot = await db.collection('users').get();
        let deletedUsersCount = 0;
        
        const userBatch = db.batch();
        allUsersSnapshot.docs.forEach((doc) => {
          if (doc.id !== superAdminUid) {
            userBatch.delete(doc.ref);
            deletedUsersCount++;
          }
        });
        
        if (deletedUsersCount > 0) {
          await userBatch.commit();
        }
        console.log(`   ✅ Deleted ${deletedUsersCount} user documents\n`);

        // Step 4: Delete Firebase Auth users except super admin
        console.log('4️⃣ Deleting Firebase Auth users (except super admin)...');
        let deletedAuthCount = 0;
        
        // List all users in batches
        let nextPageToken;
        do {
          const listUsersResult = await auth.listUsers(1000, nextPageToken);
          
          const uidsToDelete = listUsersResult.users
            .filter(user => user.uid !== superAdminUid)
            .map(user => user.uid);

          if (uidsToDelete.length > 0) {
            // Delete users in batches (Firebase allows deleting multiple users)
            await auth.deleteUsers(uidsToDelete);
            deletedAuthCount += uidsToDelete.length;
            console.log(`   🗑️  Deleted ${uidsToDelete.length} Auth users...`);
          }

          nextPageToken = listUsersResult.pageToken;
        } while (nextPageToken);

        console.log(`   ✅ Deleted ${deletedAuthCount} Auth users\n`);

        // Summary
        console.log('✅ Cleanup completed successfully!\n');
        console.log('📊 Summary:');
        console.log(`   - Collections deleted: ${collections.length}`);
        console.log(`   - Username entries deleted: ${deletedUsernamesCount}`);
        console.log(`   - Firestore users deleted: ${deletedUsersCount}`);
        console.log(`   - Auth users deleted: ${deletedAuthCount}`);
        console.log(`   - Super admin preserved: ${superAdminUid ? 'Yes ✅' : 'None found ⚠️'}`);
        console.log(`   - Super admin username preserved: ${superAdminUsername ? superAdminUsername + ' ✅' : 'None found ⚠️'}\n`);

        resolve(true);
      } catch (error) {
        console.error('\n❌ Error during cleanup:', error);
        resolve(false);
      }
    });
  });
}

// Helper function to delete a collection with optimized batching
async function deleteCollection(db, collectionPath, batchSize = 250) {
  const collectionRef = db.collection(collectionPath);
  let deletedCount = 0;
  
  // Delete in smaller batches to reduce memory usage and quota consumption
  let hasMore = true;
  while (hasMore) {
    const snapshot = await collectionRef.limit(batchSize).get();
    
    if (snapshot.size === 0) {
      hasMore = false;
      break;
    }
    
    // Use batch delete for efficiency (max 500 operations per batch)
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    deletedCount += snapshot.size;
    
    // Show progress for large collections
    if (deletedCount % 1000 === 0) {
      console.log(`   🗑️  Deleted ${deletedCount} documents...`);
    }
    
    // Small delay to avoid overwhelming Firestore
    if (snapshot.size === batchSize) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return deletedCount;
}

// Run the script
clearFirebase().then((success) => {
  if (success) {
    console.log('👋 Done! Your Firebase is now clean (except super admin).\n');
  } else {
    console.log('👋 Script terminated.\n');
  }
  process.exit(success ? 0 : 1);
});
