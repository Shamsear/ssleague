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

async function debug() {
  // Get one release
  const release = await db.collection('transactions')
    .where('transaction_type', '==', 'release')
    .where('player_type', '==', 'football')
    .limit(1)
    .get();
  
  const releaseData = release.docs[0].data();
  console.log('\nRelease transaction:');
  console.log(`  player_id: ${releaseData.player_id}`);
  console.log(`  player_name: ${releaseData.player_name}`);
  console.log(`  team_id: ${releaseData.team_id}`);
  
  // Check if this player exists in footballplayers
  const player = await sql`
    SELECT player_id, name, team_id, season_id
    FROM footballplayers
    WHERE name = ${releaseData.player_name}
    LIMIT 5
  `;
  
  console.log('\nMatching footballplayers:');
  player.forEach(p => {
    console.log(`  player_id: ${p.player_id}, name: ${p.name}, team: ${p.team_id}`);
  });
  
  process.exit(0);
}

debug().catch(e => {
  console.error(e);
  process.exit(1);
});
