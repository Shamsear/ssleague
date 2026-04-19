require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

if (!admin.apps.length) {
  if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
      })
    });
  } else {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
    admin.initializeApp({ projectId });
  }
}

const db = admin.firestore();

async function checkTypes() {
  const snapshot = await db.collection('transactions').limit(100).get();
  
  const types = new Set();
  const samples = {};
  
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const type = data.transaction_type || data.type;
    types.add(type);
    
    if (!samples[type]) {
      samples[type] = {
        ...data,
        id: doc.id
      };
    }
  });
  
  console.log('\nTransaction types found:');
  types.forEach(type => {
    console.log(`\n  ${type}:`);
    const sample = samples[type];
    console.log(`    Sample ID: ${sample.id}`);
    console.log(`    Has player_id: ${!!sample.player_id}`);
    console.log(`    Has player_name: ${!!sample.player_name}`);
    console.log(`    Fields: ${Object.keys(sample).join(', ')}`);
  });
  
  process.exit(0);
}

checkTypes().catch(e => {
  console.error(e);
  process.exit(1);
});
