require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
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
const sql = neon(process.env.NEON_DATABASE_URL);

async function find() {
  // Get one release
  const release = await db.collection('transactions')
    .where('transaction_type', '==', 'release')
    .where('player_type', '==', 'football')
    .limit(3)
    .get();
  
  for (const doc of release.docs) {
    const releaseData = doc.data();
    console.log(`\n=== ${releaseData.player_name} ===`);
    console.log(`Release: player_id=${releaseData.player_id}, team=${releaseData.team_id}, season=${releaseData.season_id}`);
    
    // Find in footballplayers
    const players = await sql`
      SELECT player_id, name, team_id, season_id, is_sold
      FROM footballplayers
      WHERE player_id = ${releaseData.player_id}
    `;
    
    console.log(`Found ${players.length} records in footballplayers:`);
    players.forEach(p => {
      console.log(`  - season=${p.season_id}, team=${p.team_id}, is_sold=${p.is_sold}`);
    });
  }
  
  process.exit(0);
}

find().catch(e => {
  console.error(e);
  process.exit(1);
});
