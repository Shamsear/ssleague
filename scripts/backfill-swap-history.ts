/**
 * Backfill Swap History
 * 
 * This script creates player_history records for ALL swap transactions
 * that exist in Firebase player_transactions collection.
 * 
 * Usage:
 *   npx tsx scripts/backfill-swap-history.ts
 * 
 * What it does:
 * 1. Fetches all swap transactions from Firebase
 * 2. For each swap, creates player_history records for both players
 * 3. Closes old history records and creates new ones
 * 4. Skips swaps that already have history records
 */

import 'dotenv/config';
import admin from 'firebase-admin';
import { neon } from '@neondatabase/serverless';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Missing Firebase credentials in environment variables');
    console.error('Required: NEXT_PUBLIC_FIREBASE_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY');
    console.error('Found:', { projectId: !!projectId, clientEmail: !!clientEmail, privateKey: !!privateKey });
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail,
      privateKey,
    }),
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  });
  console.log('✓ Firebase Admin initialized\n');
}

const adminDb = admin.firestore();

// Initialize database connection
const sql = neon(process.env.NEON_DATABASE_URL!);

// Helper functions (inline to avoid import issues)
async function closePlayerHistory(
  playerId: string,
  teamId: string,
  reason: 'release' | 'transfer' | 'swap' | 'takeover',
  currentSeason: string,
  transactionId?: string
): Promise<void> {
  const status = reason === 'release' ? 'released' : 
                 reason === 'transfer' ? 'transferred' : 
                 reason === 'swap' ? 'swapped' : 'takeover';

  await sql`
    UPDATE player_history 
    SET 
      status = ${status},
      end_date = NOW(),
      end_reason = ${reason},
      contract_end_season = ${currentSeason},
      transaction_id = ${transactionId || null},
      updated_at = NOW()
    WHERE player_id = ${playerId}
    AND team_id = ${teamId}
    AND status = 'active'
  `;
}

async function createPlayerHistory(data: {
  playerId: string;
  playerName: string;
  position: string | null;
  teamId: string;
  teamName: string;
  seasonId: string;
  acquisitionType: 'auction' | 'transfer' | 'swap' | 'takeover' | 'carryover';
  acquisitionValue: number;
  contractStartSeason: string;
  contractEndSeason: string;
  roundId?: string;
  transactionId?: string;
}): Promise<void> {
  await sql`
    INSERT INTO player_history (
      player_id,
      player_name,
      position,
      team_id,
      team_name,
      season_id,
      acquisition_type,
      acquisition_value,
      contract_start_season,
      contract_end_season,
      round_id,
      transaction_id,
      status,
      acquisition_date
    ) VALUES (
      ${data.playerId},
      ${data.playerName},
      ${data.position},
      ${data.teamId},
      ${data.teamName},
      ${data.seasonId},
      ${data.acquisitionType},
      ${data.acquisitionValue},
      ${data.contractStartSeason},
      ${data.contractEndSeason},
      ${data.roundId || null},
      ${data.transactionId || null},
      'active',
      NOW()
    )
  `;
}

async function backfillSwapHistory() {
  console.log('🔄 Starting swap history backfill...\n');
  console.log('This will process ALL swap transactions from Firebase\n');

  try {
    // Get all swap transactions from Firebase
    console.log('📥 Fetching swap transactions from Firebase...');
    const swapTransactions = await adminDb
      .collection('player_transactions')
      .where('transaction_type', '==', 'swap')
      .where('player_type', '==', 'football')
      .orderBy('created_at', 'asc') // Process oldest first
      .get();

    console.log(`✓ Found ${swapTransactions.size} swap transactions\n`);

    if (swapTransactions.size === 0) {
      console.log('No swap transactions found. Exiting.');
      return;
    }

    let processedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    const errors: Array<{ swap: string; error: string }> = [];

    for (const doc of swapTransactions.docs) {
      const swap = doc.data();
      const transactionId = doc.id;

      try {
        console.log(`\n${'─'.repeat(60)}`);
        console.log(`📋 ${swap.player_a_name} ↔ ${swap.player_b_name}`);
        console.log(`   ID: ${transactionId}`);
        console.log(`   Season: ${swap.season_id}`);
        console.log(`   Date: ${swap.created_at?.toDate?.()?.toISOString() || 'Unknown'}`);

        // Validate required fields
        if (!swap.player_a_id || !swap.player_b_id || !swap.season_id) {
          console.log(`   ⚠️  Missing required fields, skipping`);
          skippedCount++;
          continue;
        }

        // Check if history records already exist for this transaction
        const [existingHistoryA, existingHistoryB] = await Promise.all([
          sql.query(
            `SELECT id FROM player_history 
             WHERE player_id = $1 AND transaction_id = $2 
             LIMIT 1`,
            [swap.player_a_id, transactionId]
          ),
          sql.query(
            `SELECT id FROM player_history 
             WHERE player_id = $1 AND transaction_id = $2 
             LIMIT 1`,
            [swap.player_b_id, transactionId]
          )
        ]);

        if (existingHistoryA.length > 0 && existingHistoryB.length > 0) {
          console.log(`   ✓ History exists, skipping`);
          skippedCount++;
          continue;
        }

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
          console.log(`   ⚠️  Player A not found in database`);
          errors.push({ 
            swap: `${swap.player_a_name} ↔ ${swap.player_b_name}`, 
            error: 'Player A not found' 
          });
          errorCount++;
          continue;
        }

        if (playerBResult.length === 0) {
          console.log(`   ⚠️  Player B not found in database`);
          errors.push({ 
            swap: `${swap.player_a_name} ↔ ${swap.player_b_name}`, 
            error: 'Player B not found' 
          });
          errorCount++;
          continue;
        }

        const playerA = playerAResult[0];
        const playerB = playerBResult[0];

        // Get team names from Firebase
        const [teamADoc, teamBDoc] = await Promise.all([
          adminDb.collection('teams').doc(swap.team_a_id).get(),
          adminDb.collection('teams').doc(swap.team_b_id).get()
        ]);

        const teamAName = teamADoc.exists ? teamADoc.data()?.name : 'Unknown Team';
        const teamBName = teamBDoc.exists ? teamBDoc.data()?.name : 'Unknown Team';

        console.log(`   ${swap.player_a_name} → ${teamBName}`);
        console.log(`   ${swap.player_b_name} → ${teamAName}`);

        // Close old history records (if they exist and are active)
        try {
          await closePlayerHistory(
            swap.player_a_id,
            swap.team_a_id,
            'swap',
            swap.season_id,
            transactionId
          );
        } catch (e) {
          // Ignore if no active history to close
        }

        try {
          await closePlayerHistory(
            swap.player_b_id,
            swap.team_b_id,
            'swap',
            swap.season_id,
            transactionId
          );
        } catch (e) {
          // Ignore if no active history to close
        }

        // Create new history records
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

      } catch (error: any) {
        console.error(`   ❌ Error:`, error.message);
        errors.push({ 
          swap: `${swap.player_a_name} ↔ ${swap.player_b_name}`, 
          error: error.message 
        });
        errorCount++;
      }
    }

    // Print summary
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Backfill complete!`);
    console.log(`${'='.repeat(60)}`);
    console.log(`   Total swaps found: ${swapTransactions.size}`);
    console.log(`   Processed: ${processedCount}`);
    console.log(`   Skipped (already exists): ${skippedCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`${'='.repeat(60)}\n`);

    // Show errors if any
    if (errors.length > 0) {
      console.log('❌ Errors encountered:');
      errors.forEach(({ swap, error }) => {
        console.log(`   • ${swap}: ${error}`);
      });
      console.log('');
    }

    // Show success message
    if (processedCount > 0) {
      console.log(`✨ Successfully created player history for ${processedCount} swaps!`);
    }

  } catch (error) {
    console.error('❌ Backfill failed:', error);
    throw error;
  }
}

// Run the backfill
backfillSwapHistory()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
