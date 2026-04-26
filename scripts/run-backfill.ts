/**
 * Simple runner for backfill - uses existing Firebase admin setup
 */

import { adminDb } from '../lib/firebase/admin';
import { createPlayerHistory, closePlayerHistory } from '../lib/player-history';
import { getAuctionDb } from '../lib/neon/auction-config';

const PLAYER_NAMES = [
  'Erling Haaland',
  'Moise Kean',
  'Joao Palhinha',
  'Dominik Szoboszlai',
  'Ivan Perisic',
  'Michael Olise'
];

async function runBackfill() {
  console.log('🔄 Starting player history backfill...\n');
  console.log('Looking for swaps involving:');
  PLAYER_NAMES.forEach(name => console.log(`  - ${name}`));
  console.log('');

  const sql = getAuctionDb();

  try {
    // Get all swap transactions
    const swapTransactions = await adminDb
      .collection('player_transactions')
      .where('transaction_type', '==', 'swap')
      .where('player_type', '==', 'football')
      .orderBy('created_at', 'desc')
      .limit(100)
      .get();

    console.log(`Found ${swapTransactions.size} total swap transactions\n`);

    // Filter for target players
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

    console.log(`Found ${targetSwaps.length} swaps involving target players\n`);

    let processedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (const doc of targetSwaps) {
      const swap = doc.data();
      const transactionId = doc.id;

      try {
        console.log(`\n📋 ${swap.player_a_name} ↔ ${swap.player_b_name}`);

        // Get player data
        const [playerAResult, playerBResult] = await Promise.all([
          sql.query(
            `SELECT player_id, name as player_name, position, team_id, acquisition_value 
             FROM footballplayers 
             WHERE player_id = $1 LIMIT 1`,
            [swap.player_a_id]
          ),
          sql.query(
            `SELECT player_id, name as player_name, position, team_id, acquisition_value 
             FROM footballplayers 
             WHERE player_id = $1 LIMIT 1`,
            [swap.player_b_id]
          )
        ]);

        if (playerAResult.length === 0 || playerBResult.length === 0) {
          console.log(`   ⚠️  Player(s) not found`);
          errorCount++;
          continue;
        }

        const playerA = playerAResult[0];
        const playerB = playerBResult[0];

        // Get team names
        const [teamADoc, teamBDoc] = await Promise.all([
          adminDb.collection('teams').doc(swap.team_a_id).get(),
          adminDb.collection('teams').doc(swap.team_b_id).get()
        ]);

        const teamAName = teamADoc.exists ? teamADoc.data()?.name : 'Unknown Team';
        const teamBName = teamBDoc.exists ? teamBDoc.data()?.name : 'Unknown Team';

        // Check if history exists
        const [existingA, existingB] = await Promise.all([
          sql.query(
            `SELECT id FROM player_history 
             WHERE player_id = $1 AND transaction_id = $2 LIMIT 1`,
            [swap.player_a_id, transactionId]
          ),
          sql.query(
            `SELECT id FROM player_history 
             WHERE player_id = $1 AND transaction_id = $2 LIMIT 1`,
            [swap.player_b_id, transactionId]
          )
        ]);

        if (existingA.length > 0 && existingB.length > 0) {
          console.log(`   ✓ History exists, skipping`);
          skippedCount++;
          continue;
        }

        // Close old records
        try {
          await closePlayerHistory(swap.player_a_id, swap.team_a_id, 'swap', swap.season_id, transactionId);
        } catch (e) {}
        
        try {
          await closePlayerHistory(swap.player_b_id, swap.team_b_id, 'swap', swap.season_id, transactionId);
        } catch (e) {}

        // Create new records
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

        console.log(`   ✅ Created history records`);
        processedCount++;

      } catch (error) {
        console.error(`   ❌ Error:`, error);
        errorCount++;
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Complete!`);
    console.log(`   Processed: ${processedCount}`);
    console.log(`   Skipped: ${skippedCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`${'='.repeat(60)}\n`);

  } catch (error) {
    console.error('❌ Failed:', error);
    throw error;
  }
}

runBackfill()
  .then(() => {
    console.log('🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
