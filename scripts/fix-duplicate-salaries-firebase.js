/**
 * Script to fix duplicate salary deductions from match rewards in Firebase
 * 
 * This script:
 * 1. Finds duplicate match reward transactions in Firestore
 * 2. Creates reversal transactions for duplicates
 * 3. Recalculates team balances
 * 
 * Usage: node scripts/fix-duplicate-salaries-firebase.js
 */

require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

// Initialize Firebase Admin using environment variables
if (!admin.apps.length) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Missing Firebase credentials in environment variables');
    console.error('Required: NEXT_PUBLIC_FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey
    })
  });
}

const db = admin.firestore();

async function findDuplicateTransactions() {
  console.log('🔍 Finding duplicate match reward transactions in Firestore...\n');

  const transactionsRef = db.collection('transactions');
  const snapshot = await transactionsRef
    .where('transaction_type', '==', 'match_reward')
    .where('created_at', '>=', new Date('2024-12-16T00:00:00Z'))
    .orderBy('created_at', 'desc')
    .get();

  const transactions = [];
  snapshot.forEach(doc => {
    transactions.push({
      id: doc.id,
      ...doc.data()
    });
  });

  console.log(`Found ${transactions.length} match reward transactions\n`);

  // Group by team_id and description to find duplicates
  const grouped = {};
  transactions.forEach(tx => {
    const key = `${tx.team_id}_${tx.description}`;
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(tx);
  });

  // Find groups with duplicates (within 5 minutes)
  const duplicates = [];
  Object.values(grouped).forEach(group => {
    if (group.length > 1) {
      // Sort by created_at
      group.sort((a, b) => a.created_at.toDate() - b.created_at.toDate());
      
      // Check if they're within 5 minutes of each other
      for (let i = 1; i < group.length; i++) {
        const timeDiff = Math.abs(
          group[i].created_at.toDate() - group[i-1].created_at.toDate()
        ) / 1000; // seconds
        
        if (timeDiff < 300) { // Within 5 minutes
          duplicates.push({
            original: group[i-1],
            duplicate: group[i],
            timeDiff: Math.round(timeDiff)
          });
        }
      }
    }
  });

  return duplicates;
}

async function createReversalTransaction(duplicate) {
  const tx = duplicate.duplicate;
  
  console.log(`  Creating reversal for transaction ${tx.id}...`);

  const reversalData = {
    team_id: tx.team_id,
    season_id: tx.season_id,
    transaction_type: 'adjustment',
    amount_football: -tx.amount_football,
    amount_real: -tx.amount_real,
    description: `Reversal: Duplicate salary deduction - ${tx.description}`,
    created_at: admin.firestore.FieldValue.serverTimestamp()
  };

  await db.collection('transactions').add(reversalData);

  console.log(`  ✅ Reversal created: eCoin ${-tx.amount_football}, SSCoin ${-tx.amount_real}`);
}

async function recalculateTeamBalance(teamId) {
  console.log(`  Recalculating balance for team ${teamId}...`);

  // Get all transactions for this team
  const snapshot = await db.collection('transactions')
    .where('team_id', '==', teamId)
    .get();

  let footballTotal = 0;
  let realTotal = 0;

  snapshot.forEach(doc => {
    const tx = doc.data();
    footballTotal += tx.amount_football || 0;
    realTotal += tx.amount_real || 0;
  });

  // Update team balance
  await db.collection('teams').doc(teamId).update({
    football_budget: footballTotal,
    real_budget: realTotal,
    updated_at: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log(`  ✅ Balance recalculated: eCoin ${footballTotal.toFixed(2)}, SSCoin ${realTotal.toFixed(2)}`);
}

async function verifyFix() {
  console.log('\n🔍 Verifying team balances...\n');

  const teamsSnapshot = await db.collection('teams').get();
  const mismatches = [];

  for (const teamDoc of teamsSnapshot.docs) {
    const team = teamDoc.data();
    const teamId = teamDoc.id;

    // Calculate balance from transactions
    const txSnapshot = await db.collection('transactions')
      .where('team_id', '==', teamId)
      .get();

    let calculatedFootball = 0;
    let calculatedReal = 0;

    txSnapshot.forEach(doc => {
      const tx = doc.data();
      calculatedFootball += tx.amount_football || 0;
      calculatedReal += tx.amount_real || 0;
    });

    const footballDiff = Math.abs((team.football_budget || 0) - calculatedFootball);
    const realDiff = Math.abs((team.real_budget || 0) - calculatedReal);

    if (footballDiff > 0.01 || realDiff > 0.01) {
      mismatches.push({
        team_id: teamId,
        team_name: team.team_name,
        current_football: team.football_budget || 0,
        calculated_football: calculatedFootball,
        football_diff: footballDiff,
        current_real: team.real_budget || 0,
        calculated_real: calculatedReal,
        real_diff: realDiff
      });
    }
  }

  if (mismatches.length === 0) {
    console.log('✅ All team balances match transaction totals!');
  } else {
    console.log(`⚠️  Found ${mismatches.length} teams with balance mismatches:`);
    mismatches.forEach(team => {
      console.log(`  - ${team.team_name}: eCoin diff ${team.football_diff.toFixed(2)}, SSCoin diff ${team.real_diff.toFixed(2)}`);
    });
  }

  return mismatches;
}

async function main() {
  console.log('🚀 Starting duplicate salary deduction fix (Firebase)...\n');

  try {
    // Step 1: Find duplicates
    const duplicates = await findDuplicateTransactions();

    if (duplicates.length === 0) {
      console.log('✅ No duplicate transactions found!');
      process.exit(0);
    }

    console.log(`Found ${duplicates.length} duplicate transaction(s):\n`);
    duplicates.forEach((dup, idx) => {
      console.log(`${idx + 1}. Team: ${dup.duplicate.team_id}`);
      console.log(`   Description: ${dup.duplicate.description}`);
      console.log(`   Amount: eCoin ${dup.duplicate.amount_football}, SSCoin ${dup.duplicate.amount_real}`);
      console.log(`   Times: ${dup.original.created_at.toDate().toISOString()} and ${dup.duplicate.created_at.toDate().toISOString()} (${dup.timeDiff}s apart)`);
      console.log('');
    });

    // Ask for confirmation
    console.log('⚠️  This will create reversal transactions for the duplicates.');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 2: Create reversals
    console.log('Creating reversal transactions...\n');
    const affectedTeams = new Set();

    for (const duplicate of duplicates) {
      await createReversalTransaction(duplicate);
      affectedTeams.add(duplicate.duplicate.team_id);
    }

    // Step 3: Recalculate balances
    console.log('\nRecalculating team balances...\n');
    for (const teamId of affectedTeams) {
      await recalculateTeamBalance(teamId);
    }

    // Step 4: Verify
    await verifyFix();

    console.log('\n✅ Fix completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
