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
  // Get all release transactions
  const releases = await db.collection('transactions')
    .where('transaction_type', '==', 'release')
    .get();
  
  console.log(`\nTotal release transactions: ${releases.size}\n`);
  
  // Group by player_type
  const byType = {};
  const byTeam = {};
  
  releases.docs.forEach(doc => {
    const data = doc.data();
    const type = data.player_type || 'unknown';
    const team = data.team_id || 'unknown';
    
    byType[type] = (byType[type] || 0) + 1;
    byTeam[team] = (byTeam[team] || 0) + 1;
  });
  
  console.log('By player_type:');
  Object.entries(byType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
  
  console.log('\nBy team_id:');
  Object.entries(byTeam).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([team, count]) => {
    console.log(`  ${team}: ${count}`);
  });
  
  // Show sample football player releases
  console.log('\nSample football player releases:');
  const footballReleases = releases.docs.filter(doc => doc.data().player_type === 'football');
  footballReleases.slice(0, 10).forEach(doc => {
    const data = doc.data();
    console.log(`  ${data.player_name} (${data.team_name}) - ${data.season_id}`);
  });
  
  console.log(`\nTotal football player releases: ${footballReleases.length}`);
  
  process.exit(0);
}

checkReleases().catch(e => {
  console.error(e);
  process.exit(1);
});
