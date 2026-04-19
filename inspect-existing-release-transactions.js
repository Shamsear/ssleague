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

async function inspectTransactions() {
  console.log('Inspecting existing release transactions structure...\n');
  console.log('='.repeat(80));
  
  const snapshot = await db.collection('transactions')
    .where('transaction_type', '==', 'release')
    .where('season_id', '==', 'SSPSLS16')
    .get();
  
  console.log(`\nFound ${snapshot.size} release transactions\n`);
  
  const withoutMetadata = [];
  const withMetadata = [];
  
  snapshot.forEach(doc => {
    const data = doc.data();
    
    // Check if it has the old structure (with metadata) or new structure (direct fields)
    if (data.metadata && data.metadata.player_name) {
      withMetadata.push({ id: doc.id, data });
    } else if (data.player_name) {
      withoutMetadata.push({ id: doc.id, data });
    }
  });
  
  console.log(`Existing transactions (without player_name): ${withoutMetadata.length}`);
  console.log(`New transactions (with player_name): ${withMetadata.length}\n`);
  console.log('='.repeat(80));
  
  console.log('\nEXISTING TRANSACTION STRUCTURE:');
  withoutMetadata.slice(0, 4).forEach((item, index) => {
    console.log(`\nTransaction ${index + 1} (${item.id}):`);
    console.log(JSON.stringify(item.data, null, 2));
    console.log('-'.repeat(80));
  });
  
  process.exit(0);
}

inspectTransactions().catch(err => {
  console.error(err);
  process.exit(1);
});
