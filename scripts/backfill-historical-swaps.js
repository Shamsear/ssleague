/**
 * Backfill Historical Swaps
 * 
 * This script backfills swap transactions that happened before transaction tracking was implemented.
 * It creates:
 * 1. player_transactions records (for tracking)
 * 2. transactions records (for financial logging)
 * 3. player_history records (if missing)
 * 
 * Target swaps:
 * 1. Erling Haaland ↔ Moise Kean
 * 2. Joao Palhinha ↔ Dominik Szoboszlai
 * 3. Ivan Perisic ↔ Michael Olise
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

const TARGET_SWAPS = [
  { playerA: 'Erling Haaland', playerB: 'Moise Kean' },
  { playerA: 'João Palhinha', playerB: 'Dominik Szoboszlai' },
  { playerA: 'Ivan Perišić', playerB: 'Michael Olise' }
];

async function backfillHistoricalSwaps() {
  console.log('🔄 Starting backfill for historical swaps...\n');
  console.log('Target swaps:');
  TARGET_SWAPS.forEach((swap, idx) => {
    console.log(`  ${idx + 1}. ${swap.playerA} ↔ ${swap.playerB}`);
  });
  console.log('');

  let processedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const swap of TARGET_SWAPS) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📋 Processing: ${swap.playerA} ↔ ${swap.playerB}`);
    console.log('='.repeat(80));

    try {
      // Find both players in footballplayers table (search separately for better matching)
      const [playerAResults, playerBResults] = await Promise.all([
        sql`
          SELECT player_id, name, team_id, position, position_group, acquisition_value, season_id
          FROM footballplayers
          WHERE LOWER(name) LIKE ${`%${swap.playerA.toLowerCase()}%`}
          LIMIT 5
        `,
        sql`
          SELECT player_id, name, team_id, position, position_group, acquisition_value, season_id
          FROM footballplayers
          WHERE LOWER(name) LIKE ${`%${swap.playerB.toLowerCase()}%`}
          LIMIT 5
        `
      ]);

      console.log(`\n   Found ${playerAResults.length} match(es) for "${swap.playerA}"`);
      if (playerAResults.length > 0) {
        playerAResults.forEach(p => console.log(`      - ${p.name}`));
      }
      
      console.log(`   Found ${playerBResults.length} match(es) for "${swap.playerB}"`);
      if (playerBResults.length > 0) {
        playerBResults.forEach(p => console.log(`      - ${p.name}`));
      }

      if (playerAResults.length === 0 || playerBResults.length === 0) {
        console.log(`   ❌ Could not find both players in database`);
        errorCount++;
        continue;
      }

      const playerA = playerAResults[0];
      const playerB = playerBResults[0];

      console.log(`\n   Player A: ${playerA.name} (${playerA.player_id})`);
      console.log(`      Current Team: ${playerA.team_id}`);
      console.log(`      Acquisition Value: £${playerA.acquisition_value}`);
      
      console.log(`\n   Player B: ${playerB.name} (${playerB.player_id})`);
      console.log(`      Current Team: ${playerB.team_id}`);
      console.log(`      Acquisition Value: £${playerB.acquisition_value}`);

      // Get season_id (use from player data or default)
      const seasonId = playerA.season_id || playerB.season_id || 'SSPSLFB2024';
      console.log(`\n   Season: ${seasonId}`);

      // Check player_history to find the swap details
      const historyA = await sql`
        SELECT id, team_id, team_name, acquisition_type, acquisition_date, status, transaction_id
        FROM player_history
        WHERE player_id = ${playerA.player_id}
          AND acquisition_type = 'swap'
        ORDER BY acquisition_date DESC
        LIMIT 1
      `;

      const historyB = await sql`
        SELECT id, team_id, team_name, acquisition_type, acquisition_date, status, transaction_id
        FROM player_history
        WHERE player_id = ${playerB.player_id}
          AND acquisition_type = 'swap'
        ORDER BY acquisition_date DESC
        LIMIT 1
      `;

      // Determine the teams involved in the swap
      let teamAId, teamBId, swapDate;
      
      if (historyA.length > 0 && historyB.length > 0) {
        // Use history data
        teamAId = historyB[0].team_id; // Player A's original team (where Player B went)
        teamBId = historyA[0].team_id; // Player B's original team (where Player A went)
        swapDate = historyA[0].acquisition_date || historyB[0].acquisition_date || new Date();
        
        console.log(`\n   ✓ Found swap history records`);
        console.log(`      Player A moved to: ${historyA[0].team_name} (${teamBId})`);
        console.log(`      Player B moved to: ${historyB[0].team_name} (${teamAId})`);
        console.log(`      Swap Date: ${swapDate}`);

        // Check if they already have transaction_id
        if (historyA[0].transaction_id && historyB[0].transaction_id) {
          console.log(`\n   ⏭️  History records already have transaction IDs, checking if transaction exists...`);
          
          const existingTxn = await db.collection('player_transactions').doc(historyA[0].transaction_id).get();
          if (existingTxn.exists) {
            console.log(`   ✓ player_transaction already exists, skipping`);
            skippedCount++;
            continue;
          }
        }
      } else {
        console.log(`\n   ⚠️  No swap history found, using current team assignments`);
        // Assume current teams are the result of the swap
        teamAId = playerB.team_id; // Player A's original team
        teamBId = playerA.team_id; // Player B's original team
        swapDate = new Date();
      }

      // Get team details from Firebase
      const [teamADoc, teamBDoc] = await Promise.all([
        db.collection('teams').doc(teamAId).get(),
        db.collection('teams').doc(teamBId).get()
      ]);

      if (!teamADoc.exists || !teamBDoc.exists) {
        console.log(`   ❌ Could not find team documents in Firebase`);
        errorCount++;
        continue;
      }

      const teamAData = teamADoc.data();
      const teamBData = teamBDoc.data();
      const teamAName = teamAData.name;
      const teamBName = teamBData.name;

      console.log(`\n   Team A: ${teamAName} (${teamAId})`);
      console.log(`   Team B: ${teamBName} (${teamBId})`);

      // Create player_transactions record
      const transactionRef = db.collection('player_transactions').doc();
      const transactionId = transactionRef.id;

      await transactionRef.set({
        transaction_type: 'swap',
        player_a_id: playerA.player_id,
        player_a_name: playerA.name,
        player_b_id: playerB.player_id,
        player_b_name: playerB.name,
        player_type: 'football',
        team_a_id: teamAId,
        team_b_id: teamBId,
        season_id: seasonId,
        fee_team_a: 0, // Historical swaps were free
        fee_team_b: 0,
        processed_by: 'system',
        processed_by_name: 'System Backfill',
        created_at: admin.firestore.Timestamp.fromDate(new Date(swapDate)),
        backfilled: true
      });

      console.log(`\n   ✅ Created player_transaction: ${transactionId}`);

      // Update or create player_history records
      if (historyA.length > 0 && historyB.length > 0) {
        // Update existing history records with transaction_id
        await sql`
          UPDATE player_history
          SET transaction_id = ${transactionId}
          WHERE id = ${historyA[0].id}
        `;
        
        await sql`
          UPDATE player_history
          SET transaction_id = ${transactionId}
          WHERE id = ${historyB[0].id}
        `;
        
        console.log(`   ✅ Updated player_history records with transaction_id`);
      } else {
        // Create new player_history records
        console.log(`\n   Creating new player_history records...`);
        
        // Close old history records
        await sql`
          UPDATE player_history
          SET status = 'transferred'
          WHERE player_id = ${playerA.player_id}
            AND team_id = ${teamAId}
            AND status = 'active'
            AND season_id = ${seasonId}
        `;

        await sql`
          UPDATE player_history
          SET status = 'transferred'
          WHERE player_id = ${playerB.player_id}
            AND team_id = ${teamBId}
            AND status = 'active'
            AND season_id = ${seasonId}
        `;

        // Create new history records
        await sql`
          INSERT INTO player_history (
            player_id, player_name, position, team_id, team_name,
            season_id, acquisition_type, acquisition_value,
            acquisition_date, status, contract_start_season,
            contract_end_season, transaction_id
          ) VALUES (
            ${playerA.player_id},
            ${playerA.name},
            ${playerA.position},
            ${teamBId},
            ${teamBName},
            ${seasonId},
            'swap',
            ${playerB.acquisition_value},
            ${swapDate},
            'active',
            ${seasonId},
            ${seasonId},
            ${transactionId}
          )
        `;

        await sql`
          INSERT INTO player_history (
            player_id, player_name, position, team_id, team_name,
            season_id, acquisition_type, acquisition_value,
            acquisition_date, status, contract_start_season,
            contract_end_season, transaction_id
          ) VALUES (
            ${playerB.player_id},
            ${playerB.name},
            ${playerB.position},
            ${teamAId},
            ${teamAName},
            ${seasonId},
            'swap',
            ${playerA.acquisition_value},
            ${swapDate},
            'active',
            ${seasonId},
            ${seasonId},
            ${transactionId}
          )
        `;

        console.log(`   ✅ Created player_history records`);
      }

      // Create financial transactions (no fees for historical swaps, but create records for tracking)
      const teamASeasonId = `${teamAId}_${seasonId}`;
      const teamBSeasonId = `${teamBId}_${seasonId}`;

      const [teamASeasonDoc, teamBSeasonDoc] = await Promise.all([
        db.collection('team_seasons').doc(teamASeasonId).get(),
        db.collection('team_seasons').doc(teamBSeasonId).get()
      ]);

      if (teamASeasonDoc.exists && teamBSeasonDoc.exists) {
        const teamASeasonData = teamASeasonDoc.data();
        const teamBSeasonData = teamBSeasonDoc.data();
        
        const teamABudget = teamASeasonData.football_budget || teamASeasonData.budget || 0;
        const teamBBudget = teamBSeasonData.football_budget || teamBSeasonData.budget || 0;

        // Create transaction records (£0 fees, but for tracking)
        await db.collection('transactions').add({
          team_id: teamAId,
          season_id: seasonId,
          transaction_type: 'football_swap',
          amount: 0,
          balance_before: teamABudget,
          balance_after: teamABudget,
          description: `Historical swap: ${playerA.name} ↔ ${playerB.name}`,
          player_id: playerB.player_id,
          player_name: playerB.name,
          related_team_id: teamBId,
          created_at: admin.firestore.Timestamp.fromDate(new Date(swapDate)),
          backfilled: true
        });

        await db.collection('transactions').add({
          team_id: teamBId,
          season_id: seasonId,
          transaction_type: 'football_swap',
          amount: 0,
          balance_before: teamBBudget,
          balance_after: teamBBudget,
          description: `Historical swap: ${playerB.name} ↔ ${playerA.name}`,
          player_id: playerA.player_id,
          player_name: playerA.name,
          related_team_id: teamAId,
          created_at: admin.firestore.Timestamp.fromDate(new Date(swapDate)),
          backfilled: true
        });

        console.log(`   ✅ Created financial transaction records`);
      }

      console.log(`\n   ✅ Successfully backfilled swap!`);
      processedCount++;

    } catch (error) {
      console.error(`\n   ❌ Error processing swap:`, error.message);
      console.error(error.stack);
      errorCount++;
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 Summary');
  console.log('='.repeat(80));
  console.log(`   ✅ Successfully backfilled: ${processedCount}`);
  console.log(`   ⏭️  Skipped (already exists): ${skippedCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📋 Total attempted: ${TARGET_SWAPS.length}`);
  console.log('');

  if (processedCount > 0) {
    console.log('🎉 Backfill complete!\n');
    console.log('Created records:');
    console.log('  • player_transactions (for tracking)');
    console.log('  • transactions (for financial logging)');
    console.log('  • player_history (if missing)\n');
  } else {
    console.log('⚠️  No swaps were backfilled\n');
  }
}

backfillHistoricalSwaps()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    console.error(error.stack);
    process.exit(1);
  });
