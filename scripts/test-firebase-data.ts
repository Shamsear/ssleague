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
    console.log('✅ Firebase Admin initialized successfully\n');
  } else {
    console.error('❌ Missing Firebase Admin credentials');
    process.exit(1);
  }
}

const db = admin.firestore();

async function checkCollections() {
  const collections = ['users', 'teams', 'seasons', 'squads', 'fixtures', 'transactions'];
  
  console.log('📊 Checking Firebase Firestore collections:\n');
  
  for (const collectionName of collections) {
    try {
      const snapshot = await db.collection(collectionName).limit(5).get();
      console.log(`${collectionName}: ${snapshot.size} documents (showing first 5)`);
      
      if (snapshot.size > 0) {
        snapshot.docs.forEach((doc, idx) => {
          console.log(`  ${idx + 1}. ${doc.id}`);
        });
      }
    } catch (error) {
      console.log(`${collectionName}: Error - ${error}`);
    }
  }
  
  // Get total count for users
  try {
    const usersSnapshot = await db.collection('users').get();
    console.log(`\n📈 Total users: ${usersSnapshot.size}`);
    
    // Check for super admin
    const superAdminSnapshot = await db.collection('users')
      .where('role', '==', 'super_admin')
      .get();
    console.log(`👑 Super admin users: ${superAdminSnapshot.size}`);
    
    if (superAdminSnapshot.size > 0) {
      superAdminSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`   - ${doc.id} (${data.email || 'no email'})`);
      });
    }
  } catch (error) {
    console.error('Error checking users:', error);
  }
  
  await admin.app().delete();
  console.log('\n✅ Done');
}

checkCollections().catch(console.error);
