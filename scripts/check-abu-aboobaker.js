require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

async function findPlayers() {
  const playersSnapshot = await db.collection('realplayers').get();
  const matches = [];
  
  playersSnapshot.forEach(doc => {
    const data = doc.data();
    const nameLower = data.name.toLowerCase();
    if (nameLower.includes('abu') || nameLower.includes('aboobaker')) {
      matches.push({
        id: doc.id,
        player_id: data.player_id,
        name: data.name,
        display_name: data.display_name,
      });
    }
  });
  
  console.log(`Found ${matches.length} matching players:`);
  matches.forEach(p => {
    console.log(`- ${p.name} (ID: ${p.player_id}, Doc: ${p.id})`);
  });
  
  process.exit(0);
}

findPlayers();
