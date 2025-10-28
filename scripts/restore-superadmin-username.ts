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
    console.log('✅ Firebase Admin initialized\n');
  } else {
    console.error('❌ Missing Firebase credentials');
    process.exit(1);
  }
}

const db = admin.firestore();

async function restoreSuperAdminUsername() {
  try {
    console.log('🔍 Finding super admin user...\n');
    
    // Get super admin user
    const usersSnapshot = await db.collection('users')
      .where('role', '==', 'super_admin')
      .limit(1)
      .get();
    
    if (usersSnapshot.empty) {
      console.log('❌ No super admin user found!');
      process.exit(1);
    }
    
    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();
    
    console.log(`Found super admin: ${userData.username} (${userData.email})\n`);
    
    // Check if username document already exists
    const usernameDoc = await db.collection('usernames').doc(userData.username).get();
    
    if (usernameDoc.exists) {
      console.log('✅ Username document already exists!');
      console.log(`   Username: ${userData.username}`);
      console.log(`   User ID: ${usernameDoc.data()?.userId}`);
    } else {
      // Create username document
      await db.collection('usernames').doc(userData.username).set({
        userId: userDoc.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      
      console.log('✅ Username document created!');
      console.log(`   Username: ${userData.username}`);
      console.log(`   User ID: ${userDoc.id}`);
    }
    
    await admin.app().delete();
    console.log('\n✅ Done!');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

restoreSuperAdminUsername();
