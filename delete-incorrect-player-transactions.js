const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

if (!admin.apps.length) {
  const serviceAccount = {
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')
  };
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function deleteIncorrectRecords() {
  console.log('Deleting incorrect release records from player_transactions...\n');
  console.log('='.repeat(80));
  
  const snapshot = await db.collection('player_transactions')
    .where('transaction_type', '==', 'release')
    .get();
  
  console.log(`\nFound ${snapshot.size} records to delete\n`);
  
  let deleted = 0;
  const batch = db.batch();
  
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`  Deleting: ${data.player_name} (${doc.id})`);
    batch.delete(doc.ref);
    deleted++;
  });
  
  await batch.commit();
  
  console.log('\n' + '='.repeat(80));
  console.log(`\n✅ Successfully deleted ${deleted} incorrect records from player_transactions`);
  console.log('✅ Correct records remain in transactions collection');
  
  process.exit(0);
}

deleteIncorrectRecords().catch(err => {
  console.error(err);
  process.exit(1);
});
