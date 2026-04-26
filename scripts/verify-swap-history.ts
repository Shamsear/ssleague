/**
 * Verify Player History for Specific Swaps
 * 
 * This script checks if player_history records exist for the 3 specific swaps
 */

import 'dotenv/config';
import admin from 'firebase-admin';
import { getAuctionDb } from '../lib/neon/auction-config';

// Initialize Firebase Admin if not already initialized
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
      privateKey,
    }),
  });
}

const adminDb = admin.firestore();

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

  const sql = getAuctionDb();

  try {
    // Get all swap transactions from Firebase
    const swapTransactions = await adminDb
      .collection('player_transactions')
      .where('transaction_type', '==', 'swap')
      .where('player_type', '==', 'football')
      .orderBy('created_at', 'desc')
      .limit(100)
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
      const historyA = await sql.query(
        `SELECT id, player_name, team_name, acquisition_type, acquisition_value, status, 
                contract_start_season, contract_end_season, transaction_id
         FROM player_history 
         WHERE player_id = $1 
         ORDER BY acquisition_date DESC 
         LIMIT 3`,
        [swap.player_a_id]
      );

      console.log(`\n   Player A (${swap.player_a_name}):`);
      if (historyA.length === 0) {
        console.log(`      ❌ NO HISTORY RECORDS FOUND`);
      } else {
        historyA.forEach((record: any, idx: number) => {
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
      const historyB = await sql.query(
        `SELECT id, player_name, team_name, acquisition_type, acquisition_value, status,
                contract_start_season, contract_end_season, transaction_id
         FROM player_history 
         WHERE player_id = $1 
         ORDER BY acquisition_date DESC 
         LIMIT 3`,
        [swap.player_b_id]
      );

      console.log(`\n   Player B (${swap.player_b_name}):`);
      if (historyB.length === 0) {
        console.log(`      ❌ NO HISTORY RECORDS FOUND`);
      } else {
        historyB.forEach((record: any, idx: number) => {
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
      const hasHistoryA = historyA.some((r: any) => r.transaction_id === transactionId);
      const hasHistoryB = historyB.some((r: any) => r.transaction_id === transactionId);

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
        sql.query(
          `SELECT id FROM player_history 
           WHERE player_id = $1 AND transaction_id = $2`,
          [swap.player_a_id, transactionId]
        ),
        sql.query(
          `SELECT id FROM player_history 
           WHERE player_id = $1 AND transaction_id = $2`,
          [swap.player_b_id, transactionId]
        )
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
      console.log(`   npx tsx scripts/backfill-specific-swaps.ts`);
    }

    console.log(`\n${'='.repeat(80)}`);

  } catch (error) {
    console.error('❌ Verification failed:', error);
    throw error;
  }
}

// Run the verification
verifySwapHistory()
  .then(() => {
    console.log('\n🎉 Verification complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
