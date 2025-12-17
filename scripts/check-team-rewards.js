require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const admin = require('firebase-admin');

const sql = neon(process.env.DATABASE_URL);

// Initialize Firebase Admin
if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('FIREBASE_ADMIN_PRIVATE_KEY is not set in environment variables');
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

async function checkTeamRewards() {
  try {
    console.log('🔍 Checking team rewards for season SSPSLS16...\n');

    // Get all teams from Firebase
    const teamsSnapshot = await db.collection('teams').get();
    const teams = [];
    const seasonIds = new Set();
    
    for (const doc of teamsSnapshot.docs) {
      const teamData = doc.data();
      seasonIds.add(teamData.season_id);
      
      // Accept any season for now to see what we have
      teams.push({
        id: doc.id,
        name: teamData.name,
        balance: teamData.balance || 0,
        total_spent: teamData.total_spent || 0,
        season_id: teamData.season_id
      });
    }

    console.log(`Available season IDs: ${Array.from(seasonIds).join(', ')}\n`);
    
    // Filter for SSPSLS16
    const s16Teams = teams.filter(t => t.season_id === 'SSPSLS16');
    
    if (s16Teams.length === 0) {
      console.log('⚠️  No teams found for season SSPSLS16');
      console.log(`Found ${teams.length} total teams across all seasons\n`);
      
      // Show first few teams as examples
      console.log('Sample teams:');
      teams.slice(0, 5).forEach(t => {
        console.log(`  - ${t.name} (${t.id}) - Season: ${t.season_id}`);
      });
      return;
    }

    s16Teams.sort((a, b) => a.name.localeCompare(b.name));

    console.log(`Found ${s16Teams.length} teams in SSPSLS16\n`);
    console.log('═'.repeat(100));
    
    // Use s16Teams instead of teams
    const teamsToCheck = s16Teams;

    for (const team of teamsToCheck) {
      console.log(`\n📊 Team: ${team.name} (${team.id})`);
      console.log(`   Current Balance: ${team.balance} eCoin`);
      console.log(`   Total Spent: ${team.total_spent} eCoin`);

      // Get transaction history
      const transactions = await sql`
        SELECT 
          transaction_type,
          amount,
          description,
          created_at
        FROM transactions
        WHERE team_id = ${team.id}
          AND season_id = 'SSPSLS16'
        ORDER BY created_at DESC
      `;

      console.log(`\n   💰 Transaction History (${transactions.length} transactions):`);
      
      // Group by transaction type
      const grouped = {};
      let totalReceived = 0;
      let totalSpent = 0;

      transactions.forEach(tx => {
        if (!grouped[tx.transaction_type]) {
          grouped[tx.transaction_type] = { count: 0, total: 0, transactions: [] };
        }
        grouped[tx.transaction_type].count++;
        grouped[tx.transaction_type].total += parseFloat(tx.amount);
        grouped[tx.transaction_type].transactions.push(tx);

        if (parseFloat(tx.amount) > 0) {
          totalReceived += parseFloat(tx.amount);
        } else {
          totalSpent += Math.abs(parseFloat(tx.amount));
        }
      });

      // Display summary by type
      Object.entries(grouped).forEach(([type, data]) => {
        console.log(`\n   ${type}:`);
        console.log(`      Count: ${data.count}`);
        console.log(`      Total: ${data.total > 0 ? '+' : ''}${data.total} eCoin`);
        
        // Show recent transactions of this type (max 3)
        data.transactions.slice(0, 3).forEach(tx => {
          const date = new Date(tx.created_at).toLocaleString();
          console.log(`      - ${tx.amount > 0 ? '+' : ''}${tx.amount} eCoin: ${tx.description} (${date})`);
        });
        
        if (data.transactions.length > 3) {
          console.log(`      ... and ${data.transactions.length - 3} more`);
        }
      });

      console.log(`\n   📈 Summary:`);
      console.log(`      Total Received: +${totalReceived} eCoin`);
      console.log(`      Total Spent: -${totalSpent} eCoin`);
      console.log(`      Net: ${totalReceived - totalSpent} eCoin`);
      console.log(`      Current Balance: ${team.balance} eCoin`);

      // Check for match rewards specifically
      const matchRewards = transactions.filter(tx => 
        tx.description && (
          tx.description.includes('Match win reward') ||
          tx.description.includes('Match draw reward') ||
          tx.description.includes('Match loss reward')
        )
      );

      console.log(`\n   🏆 Match Rewards: ${matchRewards.length} received`);

      console.log('\n' + '─'.repeat(100));
    }

    // Get fixtures summary from Firebase
    console.log('\n\n📋 Fixtures Summary:\n');
    
    const fixturesSnapshot = await db.collection('fixtures')
      .where('season_id', '==', 'SSPSLS16')
      .get();
    
    const fixtures = [];
    const teamMap = {};
    teamsToCheck.forEach(t => teamMap[t.id] = t.name);
    
    fixturesSnapshot.forEach(doc => {
      const data = doc.data();
      fixtures.push({
        id: doc.id,
        home_team_id: data.home_team_id,
        away_team_id: data.away_team_id,
        status: data.status,
        result: data.result,
        home_score: data.home_score,
        away_score: data.away_score,
        rewards_distributed: data.rewards_distributed || false,
        home_team_name: teamMap[data.home_team_id] || data.home_team_id,
        away_team_name: teamMap[data.away_team_id] || data.away_team_id
      });
    });

    console.log(`Total Fixtures: ${fixtures.length}`);
    console.log(`Completed: ${fixtures.filter(f => f.status === 'completed').length}`);
    console.log(`Rewards Distributed: ${fixtures.filter(f => f.rewards_distributed).length}`);
    console.log(`Missing Rewards: ${fixtures.filter(f => f.status === 'completed' && !f.rewards_distributed).length}`);

    console.log('\n\n🎯 Fixtures needing rewards:\n');
    
    const needingRewards = fixtures.filter(f => f.status === 'completed' && !f.rewards_distributed);
    
    if (needingRewards.length === 0) {
      console.log('✅ All completed fixtures have rewards distributed!');
    } else {
      needingRewards.forEach(f => {
        console.log(`   Fixture ${f.id}: ${f.home_team_name} ${f.home_score || 0} - ${f.away_score || 0} ${f.away_team_name}`);
        console.log(`      Result: ${f.result || 'unknown'}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkTeamRewards()
  .then(() => {
    console.log('\n✅ Check complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
