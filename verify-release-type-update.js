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

async function verifyUpdate() {
  console.log('Verifying transaction type updates...\n');
  console.log('='.repeat(80));
  
  // Check for release transactions
  const releaseSnapshot = await db.collection('transactions')
    .where('transaction_type', '==', 'release')
    .where('season_id', '==', 'SSPSLS16')
    .get();
  
  console.log(`\n✅ Found ${releaseSnapshot.size} transactions with type "release"`);
  
  // Check for any remaining release_refund transactions
  const refundSnapshot = await db.collection('transactions')
    .where('transaction_type', '==', 'release_refund')
    .where('season_id', '==', 'SSPSLS16')
    .get();
  
  console.log(`✅ Found ${refundSnapshot.size} transactions with type "release_refund" (should be 0)`);
  
  console.log('\n' + '='.repeat(80));
  
  if (refundSnapshot.size === 0 && releaseSnapshot.size === 21) {
    console.log('\n✅ SUCCESS: All transactions updated correctly!');
  } else {
    console.log('\n⚠️  WARNING: Unexpected transaction counts');
  }
  
  process.exit(0);
}

verifyUpdate().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
