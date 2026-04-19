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

async function verifyTransactions() {
  console.log('Verifying release_refund transactions...\n');
  console.log('='.repeat(80));
  
  const snapshot = await db.collection('transactions')
    .where('transaction_type', '==', 'release_refund')
    .where('season_id', '==', 'SSPSLS16')
    .get();
  
  console.log(`\nFound ${snapshot.size} release_refund transactions for SSPSLS16\n`);
  
  const byTeam = new Map();
  
  snapshot.forEach(doc => {
    const data = doc.data();
    const teamId = data.team_id;
    
    if (!byTeam.has(teamId)) {
      byTeam.set(teamId, []);
    }
    
    byTeam.get(teamId).push({
      id: doc.id,
      player: data.metadata?.player_name || 'Unknown',
      amount: data.amount,
      date: data.created_at?.toDate?.() || data.created_at
    });
  });
  
  // Get team names
  const teamsSnapshot = await db.collection('teams').get();
  const teamNames = new Map();
  teamsSnapshot.forEach(doc => {
    teamNames.set(doc.id, doc.data().team_name);
  });
  
  // Display by team
  for (const [teamId, transactions] of byTeam.entries()) {
    const teamName = teamNames.get(teamId) || teamId;
    console.log(`\n${teamName}:`);
    transactions.forEach(t => {
      console.log(`  ✅ ${t.player} - Refund: ${t.amount} (${t.id})`);
    });
  }
  
  console.log('\n' + '='.repeat(80));
  console.log(`\nTotal: ${snapshot.size} transactions created successfully`);
  
  process.exit(0);
}

verifyTransactions().catch(err => {
  console.error(err);
  process.exit(1);
});
