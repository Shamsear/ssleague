/**
 * Backfill Player History for Specific Swaps
 * 
 * This script creates player_history records for the 3 specific swaps:
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

  try {
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
          sql`SELECT player_id, name as player_name, position, team_id, acquisition_value 
              FROM footballplayers 
              WHERE player_id = ${swap.player_a_id}
              LIMIT 1`,
          sql`SELECT player_id, name as player_name, position, team_id, acquisition_value 
              FROM footballplayers 
              WHERE player_id = ${swap.player_b_id}
              LIMIT 1`
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
          db.collection('teams').doc(swap.team_a_id).get(),
          db.collection('teams').doc(swap.team_b_id).get()
        ]);

        const teamAName = teamADoc.exists ? teamADoc.data().name : 'Unknown Team';
        const teamBName = teamBDoc.exists ? teamBDoc.data().name : 'Unknown Team';

        console.log(`   Team A: ${teamAName} (${swap.team_a_id})`);
        console.log(`   Team B: ${teamBName} (${swap.team_b_id})`);

        // Check if history records already exist for this transaction
        const [existingHistoryA, existingHistoryB] = await Promise.all([
          sql`SELECT id, status FROM player_history 
              WHERE player_id = ${swap.player_a_id} AND transaction_id = ${transactionId}
              LIMIT 1`,
          sql`SELECT id, status FROM player_history 
              WHERE player_id = ${swap.player_b_id} AND transaction_id = ${transactionId}
              LIMIT 1`
        ]);

        if (existingHistoryA.length > 0 && existingHistoryB.length > 0) {
          console.log(`   ✓ History already exists for both players, skipping`);
          skippedCount++;
          continue;
        }

        // Close old history records (set status to 'transferred')
        console.log(`   Closing old history records...`);
        
        const swapDate = swap.created_at?.toDate?.() || new Date();
        
        // Close Player A's old history with Team A
        const closedA = await sql`
          UPDATE player_history
          SET status = 'transferred',
              transfer_date = ${swapDate}
          WHERE player_id = ${swap.player_a_id}
            AND team_id = ${swap.team_a_id}
            AND status = 'active'
            AND season_id = ${swap.season_id}
        `;
        console.log(`   ✓ Closed ${closedA.count || 0} old history record(s) for Player A`);

        // Close Player B's old history with Team B
        const closedB = await sql`
          UPDATE player_history
          SET status = 'transferred',
              transfer_date = ${swapDate}
          WHERE player_id = ${swap.player_b_id}
            AND team_id = ${swap.team_b_id}
            AND status = 'active'
            AND season_id = ${swap.season_id}
        `;
        console.log(`   ✓ Closed ${closedB.count || 0} old history record(s) for Player B`);

        // Create new history records
        console.log(`   Creating new history records...`);
        
        // Player A moves to Team B
        await sql`
          INSERT INTO player_history (
            player_id, player_name, position, team_id, team_name,
            season_id, acquisition_type, acquisition_value,
            acquisition_date, status, contract_start_season,
            contract_end_season, transaction_id
          ) VALUES (
            ${swap.player_a_id},
            ${swap.player_a_name},
            ${playerA.position},
            ${swap.team_b_id},
            ${teamBName},
            ${swap.season_id},
            'swap',
            ${playerA.acquisition_value},
            ${swapDate},
            'active',
            ${swap.season_id},
            ${swap.season_id},
            ${transactionId}
          )
        `;
        console.log(`   ✓ Created history for ${swap.player_a_name} → ${teamBName}`);

        // Player B moves to Team A
        await sql`
          INSERT INTO player_history (
            player_id, player_name, position, team_id, team_name,
            season_id, acquisition_type, acquisition_value,
            acquisition_date, status, contract_start_season,
            contract_end_season, transaction_id
          ) VALUES (
            ${swap.player_b_id},
            ${swap.player_b_name},
            ${playerB.position},
            ${swap.team_a_id},
            ${teamAName},
            ${swap.season_id},
            'swap',
            ${playerB.acquisition_value},
            ${swapDate},
            'active',
            ${swap.season_id},
            ${swap.season_id},
            ${transactionId}
          )
        `;
        console.log(`   ✓ Created history for ${swap.player_b_name} → ${teamAName}`);

        console.log(`   ✅ Successfully processed swap`);
        processedCount++;

      } catch (error) {
        console.error(`   ❌ Error processing swap:`, error.message);
        console.error(error.stack);
        errorCount++;
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 Summary');
    console.log('='.repeat(60));
    console.log(`   ✅ Processed: ${processedCount}`);
    console.log(`   ⏭️  Skipped (already exists): ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📋 Total found: ${targetSwaps.length}`);
    console.log('');

    // Show summary of what was done
    if (processedCount > 0) {
      console.log('✨ Player history records created for:');
      let count = 0;
      for (const doc of targetSwaps) {
        if (count >= processedCount) break;
        const swap = doc.data();
        console.log(`   • ${swap.player_a_name} ↔ ${swap.player_b_name}`);
        count++;
      }
      console.log('\n🎉 Backfill complete!\n');
    } else {
      console.log('⚠️  No new history records were created\n');
    }

  } catch (error) {
    console.error('❌ Backfill failed:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

backfillSpecificSwaps();
