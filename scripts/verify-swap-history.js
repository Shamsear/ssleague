/**
 * Verify Player History for Specific Swaps
 * 
 * This script checks if player_history records exist for the 3 specific swaps
 */

const admin = require('firebase-admin');
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin
if (!admin.apps.length) {
  if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    console.log('✅ Firebase Admin initialized\n');
  } else {
    admin.initializeApp();
    console.log('✅ Firebase Admin initialized with default credentials\n');
  }
}

const db = admin.firestore();
const sql = neon(process.env.NEON_AUCTION_DB_URL || process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

const PLAYER_NAMES = [
  'Erling Haaland',
  'Moise Kean',
  'Joao Palhinha',
  'Dominik Szoboszlai',
  'Ivan Perisic',
  'Michael Olise'
];

async function verifySwapHistory() {
  console.log('🔍 Verifying player history for specific swaps...\n');
  console.log('Checking players:');
  PLAYER_NAMES.forEach(name => console.log(`  - ${name}`));
  console.log('');

  try {
    // First, check if player_transactions collection has any documents
    const allTransactions = await db
      .collection('player_transactions')
      .limit(10)
      .get();

    console.log(`📊 Total documents in player_transactions: ${allTransactions.size}`);
    
    if (allTransactions.size > 0) {
      console.log('\nSample transactions:');
      allTransactions.docs.slice(0, 3).forEach(doc => {
        const data = doc.data();
        console.log(`  - Type: ${data.transaction_type}, Players: ${data.player_a_name || 'N/A'} ↔ ${data.player_b_name || 'N/A'}`);
      });
    }
    console.log('');

    // Get all swap transactions from Firebase (with or without player_type)
    const swapTransactions = await db
      .collection('player_transactions')
      .where('transaction_type', '==', 'swap')
      .get();

    console.log(`Found ${swapTransactions.size} total swap transactions\n`);

    // Filter for our specific players
    const targetSwaps = swapTransactions.docs.filter(doc => {
      const swap = doc.data();
      const playerAMatch = PLAYER_NAMES.some(name => 
        swap.player_a_name?.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes(swap.player_a_name?.toLowerCase())
      );
      const playerBMatch = PLAYER_NAMES.some(name => 
        swap.player_b_name?.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes(swap.player_b_name?.toLowerCase())
      );
      return playerAMatch || playerBMatch;
    });

    console.log(`Found ${targetSwaps.length} swaps involving target players:\n`);
    console.log(`${'='.repeat(80)}\n`);

    for (const doc of targetSwaps) {
      const swap = doc.data();
      const transactionId = doc.id;

      console.log(`📋 Swap: ${swap.player_a_name} ↔ ${swap.player_b_name}`);
      console.log(`   Transaction ID: ${transactionId}`);
      console.log(`   Season: ${swap.season_id}`);
      console.log(`   Date: ${swap.created_at?.toDate?.()?.toISOString() || 'Unknown'}`);
      console.log(`   Teams: ${swap.team_a_id} ↔ ${swap.team_b_id}`);

      // Check player_transactions record
      console.log(`\n   ✅ Transaction record exists in Firebase`);

      // Check player_history for Player A
      const historyA = await sql`
        SELECT id, player_name, team_name, acquisition_type, acquisition_value, status, 
               contract_start_season, contract_end_season, transaction_id
        FROM player_history 
        WHERE player_id = ${swap.player_a_id}
        ORDER BY acquisition_date DESC 
        LIMIT 3
      `;

      console.log(`\n   Player A (${swap.player_a_name}):`);
      if (historyA.length === 0) {
        console.log(`      ❌ NO HISTORY RECORDS FOUND`);
      } else {
        historyA.forEach((record, idx) => {
          const isSwapRecord = record.transaction_id === transactionId;
          const icon = isSwapRecord ? '✅' : '  ';
          console.log(`      ${icon} Record ${idx + 1}:`);
          console.log(`         Team: ${record.team_name}`);
          console.log(`         Type: ${record.acquisition_type}`);
          console.log(`         Value: ${record.acquisition_value}`);
          console.log(`         Status: ${record.status}`);
          console.log(`         Transaction: ${record.transaction_id || 'None'}`);
          if (isSwapRecord) {
            console.log(`         ⭐ THIS IS THE SWAP RECORD`);
          }
        });
      }

      // Check player_history for Player B
      const historyB = await sql`
        SELECT id, player_name, team_name, acquisition_type, acquisition_value, status,
               contract_start_season, contract_end_season, transaction_id
        FROM player_history 
        WHERE player_id = ${swap.player_b_id}
        ORDER BY acquisition_date DESC 
        LIMIT 3
      `;

      console.log(`\n   Player B (${swap.player_b_name}):`);
      if (historyB.length === 0) {
        console.log(`      ❌ NO HISTORY RECORDS FOUND`);
      } else {
        historyB.forEach((record, idx) => {
          const isSwapRecord = record.transaction_id === transactionId;
          const icon = isSwapRecord ? '✅' : '  ';
          console.log(`      ${icon} Record ${idx + 1}:`);
          console.log(`         Team: ${record.team_name}`);
          console.log(`         Type: ${record.acquisition_type}`);
          console.log(`         Value: ${record.acquisition_value}`);
          console.log(`         Status: ${record.status}`);
          console.log(`         Transaction: ${record.transaction_id || 'None'}`);
          if (isSwapRecord) {
            console.log(`         ⭐ THIS IS THE SWAP RECORD`);
          }
        });
      }

      // Summary for this swap
      const hasHistoryA = historyA.some(r => r.transaction_id === transactionId);
      const hasHistoryB = historyB.some(r => r.transaction_id === transactionId);

      console.log(`\n   Summary:`);
      if (hasHistoryA && hasHistoryB) {
        console.log(`      ✅ Both players have history records for this swap`);
      } else if (!hasHistoryA && !hasHistoryB) {
        console.log(`      ❌ MISSING: Both players need history records`);
      } else if (!hasHistoryA) {
        console.log(`      ⚠️  MISSING: Player A needs history record`);
      } else {
        console.log(`      ⚠️  MISSING: Player B needs history record`);
      }

      console.log(`\n${'-'.repeat(80)}\n`);
    }

    // Overall summary
    console.log(`${'='.repeat(80)}`);
    console.log(`\n📊 Overall Summary:\n`);
    
    let completeCount = 0;
    let incompleteCount = 0;

    for (const doc of targetSwaps) {
      const swap = doc.data();
      const transactionId = doc.id;

      const [historyA, historyB] = await Promise.all([
        sql`SELECT id FROM player_history 
            WHERE player_id = ${swap.player_a_id} AND transaction_id = ${transactionId}`,
        sql`SELECT id FROM player_history 
            WHERE player_id = ${swap.player_b_id} AND transaction_id = ${transactionId}`
      ]);

      if (historyA.length > 0 && historyB.length > 0) {
        completeCount++;
        console.log(`   ✅ ${swap.player_a_name} ↔ ${swap.player_b_name}`);
      } else {
        incompleteCount++;
        console.log(`   ❌ ${swap.player_a_name} ↔ ${swap.player_b_name} (NEEDS BACKFILL)`);
      }
    }

    console.log(`\n   Total swaps: ${targetSwaps.length}`);
    console.log(`   Complete: ${completeCount}`);
    console.log(`   Need backfill: ${incompleteCount}`);

    if (incompleteCount > 0) {
      console.log(`\n💡 Run the backfill script to fix missing records:`);
      console.log(`   node scripts/backfill-specific-swaps.js`);
    }

    console.log(`\n${'='.repeat(80)}`);

  } catch (error) {
    console.error('❌ Verification failed:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    console.log('\n🎉 Verification complete!');
    process.exit(0);
  }
}

verifySwapHistory();
