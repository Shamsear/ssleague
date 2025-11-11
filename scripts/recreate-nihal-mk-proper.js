/**
 * Recreate Nihal MK with Proper Document ID
 * 
 * Deletes the wrong document and creates it with player_id as the document ID
 */

const admin = require('firebase-admin');
const path = require('path');

// Load environment variables
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
    console.log('✅ Firebase Admin initialized\n');
  } else {
    console.error('❌ Firebase Admin credentials not found!');
    process.exit(1);
  }
}

const db = admin.firestore();

async function recreateNihalMK() {
  console.log('🔧 Recreating Nihal MK with proper document ID...\n');
  
  const playerId = 'sspslpsl0157';
  const wrongDocId = 'u2AsYqF5pmECZPwFiOkg';
  
  try {
    // 1. Get data from wrong document
    console.log('1️⃣ Reading existing document...');
    const wrongDoc = await db.collection('realplayers').doc(wrongDocId).get();
    
    if (!wrongDoc.exists) {
      console.log('   ❌ Document not found');
      return;
    }
    
    const data = wrongDoc.data();
    console.log(`   ✅ Found: ${data.name} (player_id: ${data.player_id})\n`);
    
    // 2. Create new document with player_id as document ID
    console.log('2️⃣ Creating new document with correct ID...');
    await db.collection('realplayers').doc(playerId).set({
      ...data,
      player_id: playerId,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`   ✅ Created document with ID: ${playerId}\n`);
    
    // 3. Delete wrong document
    console.log('3️⃣ Deleting old document...');
    await db.collection('realplayers').doc(wrongDocId).delete();
    
    console.log(`   ✅ Deleted document: ${wrongDocId}\n`);
    
    // 4. Verify
    console.log('4️⃣ Verifying...');
    const verifyDoc = await db.collection('realplayers').doc(playerId).get();
    
    if (verifyDoc.exists) {
      const verifyData = verifyDoc.data();
      console.log(`   ✅ Confirmed: ${verifyData.name} exists with document ID = player_id = ${playerId}\n`);
    }
    
    console.log('✅ Complete! Nihal MK is now properly stored in Firebase.\n');
    console.log('Document structure:');
    console.log(`  Collection: realplayers`);
    console.log(`  Document ID: ${playerId}`);
    console.log(`  Field player_id: ${playerId}\n`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  }
}

// Run
recreateNihalMK().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
