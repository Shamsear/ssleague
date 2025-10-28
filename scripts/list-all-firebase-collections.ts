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

async function listAllCollections() {
  console.log('🔥 LISTING ALL FIREBASE COLLECTIONS\n');
  console.log('=' .repeat(60));
  
  try {
    // List all root-level collections
    const collections = await db.listCollections();
    
    console.log(`\nFound ${collections.length} root-level collections:\n`);
    
    let totalDocs = 0;
    
    for (const collection of collections) {
      const snapshot = await collection.count().get();
      const count = snapshot.data().count;
      
      console.log(`${collection.id}: ${count} documents`);
      totalDocs += count;
      
      // Show first 3 document IDs if any
      if (count > 0 && count <= 10) {
        const docs = await collection.limit(3).get();
        docs.docs.forEach((doc, idx) => {
          console.log(`  ${idx + 1}. ${doc.id}`);
        });
      }
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log(`📊 Total collections: ${collections.length}`);
    console.log(`📊 Total documents: ${totalDocs}`);
    console.log('=' .repeat(60));
    
  } catch (error: any) {
    console.error('Error:', error.message);
  }
  
  await admin.app().delete();
}

listAllCollections().catch(console.error);
