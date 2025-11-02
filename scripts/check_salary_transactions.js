const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkSalaryTransactions() {
  console.log('\n💰 Checking Salary Transactions for Season SSPSLS16\n');
  
  // Get all salary payment transactions
  const transactionsSnapshot = await db.collection('transactions')
    .where('season_id', '==', 'SSPSLS16')
    .where('transaction_type', '==', 'salary_payment')
    .where('currency_type', '==', 'real_player')
    .get();
  
  console.log(`Found ${transactionsSnapshot.size} salary payment transactions\n`);
  
  if (transactionsSnapshot.size > 0) {
    const transactions = [];
    transactionsSnapshot.forEach(doc => {
      const data = doc.data();
      transactions.push({
        team_id: data.team_id,
        amount: Math.abs(data.amount),
        balance_before: data.balance_before,
        balance_after: data.balance_after,
        fixture_id: data.metadata?.fixture_id,
        player_count: data.metadata?.player_count,
        created_at: data.created_at?.toDate()
      });
    });
    
    // Sort by team and date
    transactions.sort((a, b) => {
      if (a.team_id !== b.team_id) return a.team_id.localeCompare(b.team_id);
      return a.created_at - b.created_at;
    });
    
    console.log('Transactions:\n');
    transactions.forEach(t => {
      console.log(`${t.team_id}: $${t.amount.toFixed(2)} (${t.player_count} players) - Fixture: ${t.fixture_id}`);
      console.log(`  Before: $${t.balance_before.toFixed(2)} → After: $${t.balance_after.toFixed(2)}`);
      console.log(`  Date: ${t.created_at}\n`);
    });
    
    // Group by team
    const byTeam = {};
    transactions.forEach(t => {
      if (!byTeam[t.team_id]) byTeam[t.team_id] = { total: 0, count: 0 };
      byTeam[t.team_id].total += t.amount;
      byTeam[t.team_id].count += 1;
    });
    
    console.log('\n📊 Summary by Team:\n');
    Object.keys(byTeam).sort().forEach(team => {
      console.log(`${team}: $${byTeam[team].total.toFixed(2)} (${byTeam[team].count} transactions)`);
    });
  }
  
  // Check current team balances
  console.log('\n\n💵 Current Team Balances:\n');
  const teamSeasonsSnapshot = await db.collection('team_seasons')
    .where('season_id', '==', 'SSPSLS16')
    .get();
  
  const balances = [];
  teamSeasonsSnapshot.forEach(doc => {
    const data = doc.data();
    balances.push({
      team_id: data.team_id || doc.id.split('_')[0],
      current_balance: data.real_player_budget || 0,
      starting_balance: data.real_player_starting_balance || 5000
    });
  });
  
  balances.sort((a, b) => a.team_id.localeCompare(b.team_id));
  
  balances.forEach(b => {
    const spent = b.starting_balance - b.current_balance;
    console.log(`${b.team_id}: $${b.current_balance.toFixed(2)} (spent: $${spent.toFixed(2)})`);
  });
}

checkSalaryTransactions()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
