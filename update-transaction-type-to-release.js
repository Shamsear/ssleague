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

async function updateTransactionType() {
  console.log('Updating transaction_type from release_refund to release...\n');
  console.log('='.repeat(80));
  
  const snapshot = await db.collection('transactions')
    .where('transaction_type', '==', 'release_refund')
    .where('season_id', '==', 'SSPSLS16')
    .get();
  
  console.log(`\nFound ${snapshot.size} transactions to update\n`);
  
  const batch = db.batch();
  let count = 0;
  
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`  Updating: ${data.metadata?.player_name || 'Unknown'} (${doc.id})`);
    
    batch.update(doc.ref, {
      transaction_type: 'release',
      updated_at: new Date()
    });
    
    count++;
  });
  
  await batch.commit();
  
  console.log('\n' + '='.repeat(80));
  console.log(`\n✅ Successfully updated ${count} transactions from release_refund to release`);
  
  process.exit(0);
}

updateTransactionType().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
