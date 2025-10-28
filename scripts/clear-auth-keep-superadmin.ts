import * as dotenv from 'dotenv';
import * as path from 'path';
import * as admin from 'firebase-admin';
import * as readline from 'readline';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Initialize Firebase Admin
if (!admin.apps.length) {
  if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    console.log('✅ Firebase Admin initialized\n');
  } else {
    console.error('❌ Missing Firebase credentials');
    process.exit(1);
  }
}

const db = admin.firestore();
const auth = admin.auth();

// Function to prompt user for confirmation
function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, (ans: string) => {
    rl.close();
    resolve(ans);
  }));
}

async function clearAuthExceptSuperAdmin() {
  try {
    console.log('🔍 Finding super admin user in Firestore...\n');
    
    // Get super admin from Firestore
    const usersSnapshot = await db.collection('users')
      .where('role', '==', 'super_admin')
      .limit(1)
      .get();
    
    if (usersSnapshot.empty) {
      console.log('❌ No super admin user found in Firestore!');
      console.log('Cannot proceed without a super admin.');
      process.exit(1);
    }
    
    const superAdminDoc = usersSnapshot.docs[0];
    const superAdminData = superAdminDoc.data();
    const superAdminUid = superAdminDoc.id;
    
    console.log(`✅ Found super admin:`);
    console.log(`   UID: ${superAdminUid}`);
    console.log(`   Email: ${superAdminData.email}`);
    console.log(`   Username: ${superAdminData.username}\n`);
    
    // Get all users from Firebase Auth
    console.log('📋 Fetching all Firebase Authentication users...\n');
    const listUsersResult = await auth.listUsers();
    const allAuthUsers = listUsersResult.users;
    
    console.log(`Found ${allAuthUsers.length} users in Firebase Authentication\n`);
    
    // Filter users to delete (exclude super admin)
    const usersToDelete = allAuthUsers.filter(user => user.uid !== superAdminUid);
    
    if (usersToDelete.length === 0) {
      console.log('✅ No users to delete. Only super admin exists.');
      await admin.app().delete();
      return;
    }
    
    console.log(`⚠️  WARNING: About to delete ${usersToDelete.length} user(s) from Firebase Authentication`);
    console.log(`\n📋 Users to be deleted:`);
    usersToDelete.slice(0, 10).forEach((user, idx) => {
      console.log(`   ${idx + 1}. ${user.email || user.uid}`);
    });
    if (usersToDelete.length > 10) {
      console.log(`   ... and ${usersToDelete.length - 10} more`);
    }
    
    console.log(`\n✅ Will keep: ${superAdminData.email} (${superAdminUid})\n`);
    
    const answer = await askQuestion('Are you sure you want to delete these users? (yes/no): ');
    
    if (answer.toLowerCase() !== 'yes') {
      console.log('\n❌ Operation cancelled.');
      await admin.app().delete();
      process.exit(0);
    }
    
    console.log('\n🗑️  Deleting users from Firebase Authentication...\n');
    
    let deleted = 0;
    let errors = 0;
    
    // Delete users in batches
    for (const user of usersToDelete) {
      try {
        await auth.deleteUser(user.uid);
        deleted++;
        if (deleted % 10 === 0) {
          console.log(`   Deleted ${deleted}/${usersToDelete.length} users...`);
        }
      } catch (error: any) {
        console.error(`   ✗ Failed to delete ${user.email || user.uid}: ${error.message}`);
        errors++;
      }
    }
    
    console.log(`\n✅ Authentication cleanup completed!`);
    console.log(`   Deleted: ${deleted} users`);
    console.log(`   Errors: ${errors}`);
    console.log(`   Kept: 1 super admin (${superAdminData.email})`);
    
    await admin.app().delete();
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

clearAuthExceptSuperAdmin();
