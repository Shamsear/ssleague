import * as dotenv from 'dotenv';
import * as path from 'path';
import * as admin from 'firebase-admin';

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
  }
}

const db = admin.firestore();

async function verifySuperAdmin() {
  try {
    console.log('🔍 Checking super admin setup...\n');
    
    // 1. Check users collection
    console.log('1️⃣ Checking users collection:');
    const usersSnapshot = await db.collection('users')
      .where('role', '==', 'super_admin')
      .get();
    
    if (usersSnapshot.empty) {
      console.log('   ❌ No super admin found in users collection!\n');
    } else {
      const userDoc = usersSnapshot.docs[0];
      const userData = userDoc.data();
      console.log('   ✅ Super admin user found:');
      console.log(`      UID: ${userDoc.id}`);
      console.log(`      Email: ${userData.email}`);
      console.log(`      Username: ${userData.username}`);
      console.log(`      Role: ${userData.role}\n`);
      
      // 2. Check username document
      console.log('2️⃣ Checking usernames collection:');
      const usernameDoc = await db.collection('usernames').doc(userData.username).get();
      
      if (!usernameDoc.exists) {
        console.log(`   ❌ Username document "${userData.username}" NOT found!`);
        console.log('   Creating it now...\n');
        
        await db.collection('usernames').doc(userData.username).set({
          userId: userDoc.id,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        
        console.log('   ✅ Username document created!\n');
      } else {
        const usernameData = usernameDoc.data();
        console.log('   ✅ Username document found:');
        console.log(`      Username: ${usernameDoc.id}`);
        console.log(`      Maps to UID: ${usernameData?.userId}`);
        console.log(`      Match: ${usernameData?.userId === userDoc.id ? '✅' : '❌'}\n`);
      }
      
      // 3. Check Firebase Auth
      console.log('3️⃣ Checking Firebase Authentication:');
      try {
        const authUser = await admin.auth().getUser(userDoc.id);
        console.log('   ✅ Auth user found:');
        console.log(`      UID: ${authUser.uid}`);
        console.log(`      Email: ${authUser.email}`);
        console.log(`      Email verified: ${authUser.emailVerified}`);
        console.log(`      Disabled: ${authUser.disabled}\n`);
      } catch (error: any) {
        console.log(`   ❌ Auth user NOT found: ${error.message}\n`);
      }
    }
    
    // 4. List all usernames
    console.log('4️⃣ All username documents:');
    const allUsernames = await db.collection('usernames').get();
    if (allUsernames.empty) {
      console.log('   (none)\n');
    } else {
      allUsernames.docs.forEach(doc => {
        console.log(`   - ${doc.id} → ${doc.data().userId}`);
      });
      console.log();
    }
    
    await admin.app().delete();
    console.log('✅ Verification complete!');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifySuperAdmin();
