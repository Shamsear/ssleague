require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('FIREBASE_ADMIN_PRIVATE_KEY is not set');
  }
  
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    }),
  });
  console.log('✅ Firebase Admin initialized\n');
}

const db = admin.firestore();

async function verifyRewards() {
  try {
    const seasonId = process.argv[2] || 'SSPSLS16';
    console.log(`🔍 Verifying rewards distribution for season ${seasonId}\n`);

    // Get all match reward transactions
    const transactionsSnapshot = await db.collection('transactions')
      .where('transaction_type', '==', 'match_reward')
      .get();

    console.log(`Found ${transactionsSnapshot.size} match reward transactions\n`);

    // Group by team
    const teamRewards = {};
    const fixtureRewards = new Set();

    transactionsSnapshot.forEach(doc => {
      const data = doc.data();
      const teamId = data.team_id;
      const fixtureId = data.metadata?.fixture_id;
      
      if (fixtureId) {
        fixtureRewards.add(fixtureId);
      }

      if (!teamRewards[teamId]) {
        teamRewards[teamId] = {
          team_id: teamId,
          total_ecoin: 0,
          total_sscoin: 0,
          transactions: []
        };
      }

      teamRewards[teamId].total_ecoin += data.amount || 0;
      teamRewards[teamId].total_sscoin += data.amount_real || 0;
      teamRewards[teamId].transactions.push({
        description: data.description,
        ecoin: data.amount || 0,
        sscoin: data.amount_real || 0,
        created_at: data.created_at?.toDate?.() || data.created_at,
        retroactive: data.metadata?.retroactive || false
      });
    });

    console.log(`${fixtureRewards.size} unique fixtures have rewards distributed\n`);
    console.log('═'.repeat(80));

    // Get team names from team_seasons
    const teamSeasonSnapshot = await db.collection('team_seasons').get();
    const teamNames = {};
    
    teamSeasonSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.team_id) {
        teamNames[data.team_id] = data.team_name || data.team_id;
      }
    });

    // Display rewards by team
    const sortedTeams = Object.values(teamRewards).sort((a, b) => 
      b.total_ecoin - a.total_ecoin
    );

    for (const team of sortedTeams) {
      const teamName = teamNames[team.team_id] || team.team_id;
      console.log(`\n📊 ${teamName}`);
      console.log(`   Total Match Rewards: ${team.total_ecoin} eCoin, ${team.total_sscoin} SSCoin`);
      console.log(`   Transactions: ${team.transactions.length}`);
      
      const retroactive = team.transactions.filter(t => t.retroactive).length;
      if (retroactive > 0) {
        console.log(`   Retroactive: ${retroactive} transactions`);
      }

      // Show recent transactions
      const recent = team.transactions.slice(-3);
      console.log(`\n   Recent transactions:`);
      recent.forEach(tx => {
        const date = tx.created_at instanceof Date ? tx.created_at.toLocaleString() : 'N/A';
        const retro = tx.retroactive ? ' [Retroactive]' : '';
        console.log(`      ${tx.description}${retro}`);
        console.log(`      +${tx.ecoin} eCoin, +${tx.sscoin} SSCoin (${date})`);
      });
    }

    console.log('\n' + '═'.repeat(80));
    console.log(`\n✅ Verification complete!`);
    console.log(`   Total teams with rewards: ${sortedTeams.length}`);
    console.log(`   Total fixtures with rewards: ${fixtureRewards.size}`);
    console.log(`   Total transactions: ${transactionsSnapshot.size}`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

verifyRewards()
  .then(() => {
    console.log('\n✅ Script complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
