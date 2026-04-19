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

async function verifyFootballReleases() {
  console.log('Verifying all football player release transactions...\n');
  console.log('='.repeat(80));
  
  const snapshot = await db.collection('transactions')
    .where('transaction_type', '==', 'release')
    .where('season_id', '==', 'SSPSLS16')
    .where('player_type', '==', 'football')
    .get();
  
  console.log(`\nFound ${snapshot.size} football player release transactions for SSPSLS16\n`);
  
  const byTeam = new Map();
  
  snapshot.forEach(doc => {
    const data = doc.data();
    const teamName = data.team_name || 'Unknown';
    
    if (!byTeam.has(teamName)) {
      byTeam.set(teamName, []);
    }
    
    byTeam.get(teamName).push({
      player: data.player_name,
      refund: data.refund_amount,
      timing: data.release_timing
    });
  });
  
  // Display by team
  for (const [teamName, players] of byTeam.entries()) {
    console.log(`\n${teamName}:`);
    players.forEach(p => {
      console.log(`  ✅ ${p.player} - Refund: ${p.refund} - Timing: ${p.timing}`);
    });
  }
  
  console.log('\n' + '='.repeat(80));
  console.log(`\nTotal: ${snapshot.size} football player releases`);
  
  // Check for real player releases too
  const realSnapshot = await db.collection('transactions')
    .where('transaction_type', '==', 'release')
    .where('season_id', '==', 'SSPSLS16')
    .where('player_type', '==', 'real')
    .get();
  
  console.log(`Real player releases: ${realSnapshot.size}`);
  console.log(`\nGrand total: ${snapshot.size + realSnapshot.size} release transactions for SSPSLS16`);
  
  process.exit(0);
}

verifyFootballReleases().catch(err => {
  console.error(err);
  process.exit(1);
});
