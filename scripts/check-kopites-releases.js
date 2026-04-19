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

async function checkReleases() {
  const releases = await db.collection('transactions')
    .where('team_id', '==', 'SSPSLT0023')
    .where('transaction_type', '==', 'release')
    .get();
  
  console.log(`\nFound ${releases.size} release transactions for Kopites\n`);
  
  releases.docs.slice(0, 5).forEach(doc => {
    const data = doc.data();
    console.log(`${data.player_name} - ${data.season_id} - ${data.created_at?.toDate()}`);
  });
  
  process.exit(0);
}

checkReleases().catch(e => {
  console.error(e);
  process.exit(1);
});
