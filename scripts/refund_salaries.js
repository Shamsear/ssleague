const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function refundSalaries() {
  const season_id = 'SSPSLS16';
  
  console.log(`\n💰 Refunding Salary Deductions for Season ${season_id}\n`);
  
  // Get all salary payment transactions
  const transactionsSnapshot = await db.collection('transactions')
    .where('season_id', '==', season_id)
    .where('transaction_type', '==', 'salary_payment')
    .where('currency_type', '==', 'real_player')
    .get();
  
  if (transactionsSnapshot.empty) {
    console.log('⚠️  No salary payment transactions found to refund');
    return;
  }
  
  console.log(`Found ${transactionsSnapshot.size} salary payment transactions\n`);
  
  // Group by team
  const refunds = {};
  transactionsSnapshot.forEach(doc => {
    const data = doc.data();
    const team_id = data.team_id;
    const amount = Math.abs(data.amount); // Get positive amount
    
    if (!refunds[team_id]) {
      refunds[team_id] = 0;
    }
    refunds[team_id] += amount;
  });
  
  // Apply refunds
  console.log('Processing refunds:\n');
  
  for (const [team_id, refund_amount] of Object.entries(refunds)) {
    const teamSeasonDocId = `${team_id}_${season_id}`;
    const teamSeasonRef = db.collection('team_seasons').doc(teamSeasonDocId);
    const teamSeasonDoc = await teamSeasonRef.get();
    
    if (!teamSeasonDoc.exists) {
      console.log(`  ❌ ${team_id}: Team season document not found (${teamSeasonDocId})`);
      continue;
    }
    
    const data = teamSeasonDoc.data();
    const current_balance = data.real_player_budget || 0;
    const new_balance = current_balance + refund_amount;
    
    // Update balance
    await teamSeasonRef.update({
      real_player_budget: new_balance,
      updated_at: new Date()
    });
    
    console.log(`  ✅ ${team_id}: Refunded $${refund_amount.toFixed(2)}`);
    console.log(`     Balance: $${current_balance.toFixed(2)} → $${new_balance.toFixed(2)}\n`);
  }
  
  // Delete salary payment transactions
  console.log('\nDeleting salary payment transactions...\n');
  const batch = db.batch();
  
  transactionsSnapshot.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  
  console.log(`✅ Deleted ${transactionsSnapshot.size} salary payment transactions`);
  console.log(`\n✅ Refund complete! All teams have been refunded their salary deductions.\n`);
}

refundSalaries()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
