/**
 * Backfill Player History for Specific Swaps
 * 
 * This script creates player_history records for the 3 specific swaps:
 * 1. Erling Haaland ↔ Moise Kean
 * 2. Joao Palhinha ↔ Dominik Szoboszlai
 * 3. Ivan Perisic ↔ Michael Olise
 */

import 'dotenv/config';
import admin from 'firebase-admin';
import { createPlayerHistory, closePlayerHistory } from '../lib/player-history';
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

async function backfillSpecificSwaps() {
  console.log('🔄 Starting player history backfill for specific swaps...\n');
  console.log('Looking for swaps involving:');
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
      .limit(100) // Get recent swaps
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

    let processedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (const doc of targetSwaps) {
      const swap = doc.data();
      const transactionId = doc.id;

      try {
        console.log(`\n📋 Processing swap: ${swap.player_a_name} ↔ ${swap.player_b_name}`);
        console.log(`   Transaction ID: ${transactionId}`);
        console.log(`   Season: ${swap.season_id}`);
        console.log(`   Date: ${swap.created_at?.toDate?.()?.toISOString() || 'Unknown'}`);

        // Get current player data from footballplayers
        const [playerAResult, playerBResult] = await Promise.all([
          sql.query(
            `SELECT player_id, name as player_name, position, team_id, acquisition_value 
             FROM footballplayers 
             WHERE player_id = $1 
             LIMIT 1`,
            [swap.player_a_id]
          ),
          sql.query(
            `SELECT player_id, name as player_name, position, team_id, acquisition_value 
             FROM footballplayers 
             WHERE player_id = $1 
             LIMIT 1`,
            [swap.player_b_id]
          )
        ]);

        if (playerAResult.length === 0) {
          console.log(`   ⚠️  Player A (${swap.player_a_name}) not found in database`);
          errorCount++;
          continue;
        }

        if (playerBResult.length === 0) {
          console.log(`   ⚠️  Player B (${swap.player_b_name}) not found in database`);
          errorCount++;
          continue;
        }

        const playerA = playerAResult[0];
        const playerB = playerBResult[0];

        console.log(`   Player A: ${playerA.player_name} (ID: ${playerA.player_id})`);
        console.log(`   Player B: ${playerB.player_name} (ID: ${playerB.player_id})`);

        // Get team names
        const [teamADoc, teamBDoc] = await Promise.all([
          adminDb.collection('teams').doc(swap.team_a_id).get(),
          adminDb.collection('teams').doc(swap.team_b_id).get()
        ]);

        const teamAName = teamADoc.exists ? teamADoc.data()?.name : 'Unknown Team';
        const teamBName = teamBDoc.exists ? teamBDoc.data()?.name : 'Unknown Team';

        console.log(`   Team A: ${teamAName} (${swap.team_a_id})`);
        console.log(`   Team B: ${teamBName} (${swap.team_b_id})`);

        // Check if history records already exist for this transaction
        const [existingHistoryA, existingHistoryB] = await Promise.all([
          sql.query(
            `SELECT id, status FROM player_history 
             WHERE player_id = $1 AND transaction_id = $2 
             LIMIT 1`,
            [swap.player_a_id, transactionId]
          ),
          sql.query(
            `SELECT id, status FROM player_history 
             WHERE player_id = $1 AND transaction_id = $2 
             LIMIT 1`,
            [swap.player_b_id, transactionId]
          )
        ]);

        if (existingHistoryA.length > 0 && existingHistoryB.length > 0) {
          console.log(`   ✓ History already exists for both players, skipping`);
          skippedCount++;
          continue;
        }

        // Close old history records (if they exist and are active)
        console.log(`   Closing old history records...`);
        try {
          await closePlayerHistory(
            swap.player_a_id,
            swap.team_a_id,
            'swap',
            swap.season_id,
            transactionId
          );
          console.log(`   ✓ Closed Player A old history`);
        } catch (e) {
          console.log(`   ℹ️  No active history to close for Player A`);
        }

        try {
          await closePlayerHistory(
            swap.player_b_id,
            swap.team_b_id,
            'swap',
            swap.season_id,
            transactionId
          );
          console.log(`   ✓ Closed Player B old history`);
        } catch (e) {
          console.log(`   ℹ️  No active history to close for Player B`);
        }

        // Create new history records
        console.log(`   Creating new history records...`);
        
        await createPlayerHistory({
          playerId: swap.player_a_id,
          playerName: swap.player_a_name,
          position: playerA.position,
          teamId: swap.team_b_id,
          teamName: teamBName,
          seasonId: swap.season_id,
          acquisitionType: 'swap',
          acquisitionValue: playerA.acquisition_value,
          contractStartSeason: swap.season_id,
          contractEndSeason: swap.season_id,
          transactionId: transactionId
        });
        console.log(`   ✓ Created history for ${swap.player_a_name} → ${teamBName}`);

        await createPlayerHistory({
          playerId: swap.player_b_id,
          playerName: swap.player_b_name,
          position: playerB.position,
          teamId: swap.team_a_id,
          teamName: teamAName,
          seasonId: swap.season_id,
          acquisitionType: 'swap',
          acquisitionValue: playerB.acquisition_value,
          contractStartSeason: swap.season_id,
          contractEndSeason: swap.season_id,
          transactionId: transactionId
        });
        console.log(`   ✓ Created history for ${swap.player_b_name} → ${teamAName}`);

        console.log(`   ✅ Successfully processed swap`);
        processedCount++;

      } catch (error) {
        console.error(`   ❌ Error processing swap:`, error);
        errorCount++;
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Backfill complete!`);
    console.log(`   Processed: ${processedCount}`);
    console.log(`   Skipped (already exists): ${skippedCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Total found: ${targetSwaps.length}`);
    console.log(`${'='.repeat(60)}\n`);

    // Show summary of what was done
    if (processedCount > 0) {
      console.log('✨ Player history records created for:');
      targetSwaps.slice(0, processedCount).forEach(doc => {
        const swap = doc.data();
        console.log(`   • ${swap.player_a_name} ↔ ${swap.player_b_name}`);
      });
    }

  } catch (error) {
    console.error('❌ Backfill failed:', error);
    throw error;
  }
}

// Run the backfill
backfillSpecificSwaps()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
