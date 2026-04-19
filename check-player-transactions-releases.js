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

async function checkPlayerTransactions() {
  console.log('Checking for release records in player_transactions collection...\n');
  
  // Check for any release-related records
  const snapshot = await db.collection('player_transactions')
    .where('transaction_type', '==', 'release')
    .get();
  
  console.log(`Found ${snapshot.size} release records in player_transactions\n`);
  
  if (snapshot.size > 0) {
    console.log('Records to delete:');
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`  - ${doc.id}: ${data.player_name} (${data.team_id})`);
    });
  }
  
  process.exit(0);
}

checkPlayerTransactions().catch(err => {
  console.error(err);
  process.exit(1);
});
