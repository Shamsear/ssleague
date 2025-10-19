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
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
      })
    });
    console.log('✅ Firebase Admin initialized with environment credentials');
  } else {
    console.error('❌ Error: Firebase Admin credentials not found!');
    process.exit(1);
  }
}

const db = admin.firestore();
const auth = admin.auth();

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// ULTRA-EFFICIENT: Only count documents without reading their data
async function countDocuments(collectionName) {
  try {
    const snapshot = await db.collection(collectionName).count().get();
    return snapshot.data().count;
  } catch (error) {
    // If count() fails, collection doesn't exist or is empty
    return 0;
  }
}

// EFFICIENT: Delete documents in optimized batches
async function deleteCollectionEfficiently(collectionName, batchSize = 100) {
  const collectionRef = db.collection(collectionName);
  let totalDeleted = 0;
  
  while (true) {
    // Query only document IDs (no data), which is cheaper
    const snapshot = await collectionRef.select().limit(batchSize).get();
    
    if (snapshot.size === 0) break;
    
    // Batch delete
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    
    totalDeleted += snapshot.size;
    
    // Progress update every 500 docs
    if (totalDeleted % 500 === 0) {
      console.log(`      📊 Deleted ${totalDeleted} documents...`);
    }
    
    // Delay to avoid rate limiting
    if (snapshot.size === batchSize) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  
  return totalDeleted;
}

async function clearFirebase() {
  console.log('\n🔥 EFFICIENT Firebase Cleanup Script\n');
  console.log('⚠️  WARNING: This will DELETE all data except super admin!\n');
  
  return new Promise((resolve) => {
    rl.question('❓ Type "DELETE ALL" to confirm: ', async (answer) => {
      rl.close();
      
      if (answer !== 'DELETE ALL') {
        console.log('\n❌ Cancelled.');
        resolve(false);
        return;
      }

      console.log('\n🚀 Starting efficient cleanup...\n');

      try {
        // Step 1: Identify super admin
        console.log('1️⃣ Identifying super admin...');
        const superAdminSnapshot = await db.collection('users')
          .where('role', '==', 'super_admin')
          .select('username')  // Only fetch username field
          .limit(1)
          .get();

        let superAdminUid = null;
        let superAdminUsername = null;
        
        if (!superAdminSnapshot.empty) {
          superAdminUid = superAdminSnapshot.docs[0].id;
          superAdminUsername = superAdminSnapshot.docs[0].data().username?.toLowerCase();
          console.log(`   ✅ Super admin UID: ${superAdminUid}`);
          if (superAdminUsername) {
            console.log(`   ✅ Super admin username: ${superAdminUsername}\n`);
          }
        } else {
          console.log('   ⚠️  No super admin found!\n');
        }

        // Step 2: Count documents first (cheaper than fetching)
        console.log('2️⃣ Counting documents (this is cheap)...');
        const collections = [
          'seasons',
          'teams',
          'teamstats',
          'realplayers',
          'realplayerstats',
          'bids',
          'matches',
          'invites',
          'awards',
          'footballPlayers'
        ];

        const counts = {};
        for (const collection of collections) {
          const count = await countDocuments(collection);
          counts[collection] = count;
          console.log(`   📊 ${collection}: ${count} documents`);
        }
        console.log();

        // Step 3: Delete collections efficiently
        console.log('3️⃣ Deleting collections...');
        const deleteCounts = {};
        
        for (const collection of collections) {
          if (counts[collection] > 0) {
            console.log(`   🗑️  Deleting ${collection} (${counts[collection]} docs)...`);
            const deleted = await deleteCollectionEfficiently(collection);
            deleteCounts[collection] = deleted;
            console.log(`   ✅ Deleted ${deleted} documents from ${collection}\n`);
          } else {
            console.log(`   ⏭️  Skipping ${collection} (empty)\n`);
            deleteCounts[collection] = 0;
          }
        }

        // Step 4: Delete usernames (except super admin)
        console.log('4️⃣ Deleting usernames...');
        const usernamesSnapshot = await db.collection('usernames').select().get();
        let deletedUsernames = 0;
        
        if (usernamesSnapshot.size > 0) {
          const batch = db.batch();
          usernamesSnapshot.docs.forEach(doc => {
            if (superAdminUsername && doc.id === superAdminUsername) {
              console.log(`   🔒 Keeping super admin username: ${doc.id}`);
            } else {
              batch.delete(doc.ref);
              deletedUsernames++;
            }
          });
          
          if (deletedUsernames > 0) await batch.commit();
        }
        console.log(`   ✅ Deleted ${deletedUsernames} username entries\n`);

        // Step 5: Delete Firestore users (except super admin)
        console.log('5️⃣ Deleting Firestore users...');
        const usersSnapshot = await db.collection('users').select().get();
        let deletedUsers = 0;
        
        if (usersSnapshot.size > 0) {
          const batch = db.batch();
          usersSnapshot.docs.forEach(doc => {
            if (doc.id !== superAdminUid) {
              batch.delete(doc.ref);
              deletedUsers++;
            }
          });
          
          if (deletedUsers > 0) await batch.commit();
        }
        console.log(`   ✅ Deleted ${deletedUsers} user documents\n`);

        // Step 6: Delete Firebase Auth users (except super admin)
        console.log('6️⃣ Deleting Firebase Auth users...');
        let deletedAuth = 0;
        let nextPageToken;
        
        do {
          const listResult = await auth.listUsers(1000, nextPageToken);
          const uidsToDelete = listResult.users
            .filter(user => user.uid !== superAdminUid)
            .map(user => user.uid);

          if (uidsToDelete.length > 0) {
            await auth.deleteUsers(uidsToDelete);
            deletedAuth += uidsToDelete.length;
            console.log(`   🗑️  Deleted ${uidsToDelete.length} Auth users...`);
          }

          nextPageToken = listResult.pageToken;
        } while (nextPageToken);
        
        console.log(`   ✅ Deleted ${deletedAuth} Auth users\n`);

        // Summary
        console.log('✅ CLEANUP COMPLETED!\n');
        console.log('📊 Summary:');
        console.log(`   Collections processed: ${collections.length}`);
        console.log(`   Total documents deleted: ${Object.values(deleteCounts).reduce((a, b) => a + b, 0)}`);
        console.log(`   Usernames deleted: ${deletedUsernames}`);
        console.log(`   Firestore users deleted: ${deletedUsers}`);
        console.log(`   Auth users deleted: ${deletedAuth}`);
        console.log(`   Super admin preserved: ${superAdminUid ? '✅ Yes' : '⚠️ None found'}\n`);

        resolve(true);
      } catch (error) {
        console.error('\n❌ Error:', error);
        resolve(false);
      }
    });
  });
}

// Run
clearFirebase().then((success) => {
  console.log(success ? '👋 Done!\n' : '👋 Terminated.\n');
  process.exit(success ? 0 : 1);
});
