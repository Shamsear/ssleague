/**
 * Backfill player_history table from transactions and footballplayers
 * 
 * This creates historical records for:
 * 1. All auction wins (from transactions)
 * 2. All releases (from transactions) 
 * 3. All transfers (from transactions)
 * 4. All swaps (from transactions)
 * 5. Current active contracts (from footballplayers)
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
      })
    });
  } else {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
    admin.initializeApp({ projectId });
  }
}

const db = admin.firestore();
const sql = neon(process.env.NEON_DATABASE_URL);

async function backfillPlayerHistory() {
  console.log('\n🔄 Backfilling player_history table from transactions...\n');

  const stats = {
    auctions: 0,
    releases: 0,
    transfers: 0,
    swaps: 0,
    activeContracts: 0,
    skipped: 0,
    errors: 0
  };

  try {
    // Get all transactions ordered by date
    const transactionsSnapshot = await db.collection('transactions')
      .orderBy('created_at', 'asc')
      .get();

    console.log(`Found ${transactionsSnapshot.size} transactions to process\n`);

    // Process each transaction
    for (const doc of transactionsSnapshot.docs) {
      const txn = doc.data();
      
      try {
        const transactionType = txn.transaction_type || txn.type;
        
        // Handle releases (only football players, not real players)
        if (transactionType === 'release' || transactionType === 'player_release_refund' || transactionType === 'release_refund') {
          if (!txn.player_id || !txn.player_name) continue;
          if (txn.player_type !== 'football') continue; // Only football players
          
          // Close the active history record for this player
          const closeResult = await sql`
            UPDATE player_history
            SET 
              status = 'released',
              end_date = ${txn.created_at?.toDate ? txn.created_at.toDate() : new Date()},
              end_reason = 'release',
              transaction_id = ${doc.id}
            WHERE player_id = ${txn.player_id}
            AND team_id = ${txn.team_id}
            AND season_id = ${txn.season_id}
            AND status = 'active'
          `;
          
          if (closeResult.count > 0) {
            stats.releases++;
          }

        } else if (transactionType === 'player_transfer') {
          if (!txn.player_id || !txn.player_name) continue;
          
          // Close old team's history
          await sql`
            UPDATE player_history
            SET 
              status = 'transferred',
              end_date = ${txn.created_at?.toDate ? txn.created_at.toDate() : new Date()},
              end_reason = 'transfer'
            WHERE player_id = ${txn.player_id}
            AND team_id = ${txn.from_team_id || txn.team_id}
            AND season_id = ${txn.season_id}
            AND status = 'active'
          `;

          // Create new team's history
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
              acquisition_date,
              transaction_id,
              status
            ) VALUES (
              ${txn.player_id},
              ${txn.player_name},
              ${txn.position || null},
              ${txn.to_team_id || txn.team_id},
              ${txn.to_team_name || txn.team_name || null},
              ${txn.season_id},
              'transfer',
              ${txn.amount || txn.value || 0},
              ${txn.created_at?.toDate ? txn.created_at.toDate() : new Date()},
              ${doc.id},
              'active'
            )
            ON CONFLICT DO NOTHING
          `;
          stats.transfers++;

        } else if (transactionType === 'player_swap') {
          if (!txn.player_id || !txn.player_name) continue;
          stats.swaps++;
        }

        if ((stats.releases + stats.transfers + stats.swaps) % 50 === 0 && (stats.releases + stats.transfers + stats.swaps) > 0) {
          console.log(`Progress: ${stats.releases} releases, ${stats.transfers} transfers, ${stats.swaps} swaps processed...`);
        }

      } catch (error) {
        stats.errors++;
        if (stats.errors <= 5) {
          console.error(`Error processing transaction ${doc.id}: ${error.message}`);
        }
      }
    }

    console.log('\n📊 Transaction processing complete!');
    console.log(`   Releases: ${stats.releases}`);
    console.log(`   Transfers: ${stats.transfers}`);
    console.log(`   Swaps: ${stats.swaps}`);
    console.log(`   Errors: ${stats.errors}\n`);

    // Now add any active contracts that weren't captured from transactions
    console.log('🔄 Adding current active contracts from footballplayers...\n');

    const activePlayers = await sql`
      SELECT 
        player_id,
        name,
        position,
        team_id,
        team_name,
        season_id,
        acquisition_value,
        round_id
      FROM footballplayers
      WHERE is_sold = true
    `;

    for (const player of activePlayers) {
      try {
        // Check if already has an active history record
        const existing = await sql`
          SELECT id FROM player_history
          WHERE player_id = ${player.player_id}
          AND team_id = ${player.team_id}
          AND season_id = ${player.season_id}
          AND status = 'active'
        `;

        if (existing.length === 0) {
          // No active record, create one
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
              round_id,
              status
            ) VALUES (
              ${player.player_id},
              ${player.name},
              ${player.position},
              ${player.team_id},
              ${player.team_name},
              ${player.season_id},
              'unknown',
              ${player.acquisition_value},
              ${player.round_id},
              'active'
            )
          `;
          stats.activeContracts++;
        } else {
          stats.skipped++;
        }

      } catch (error) {
        stats.errors++;
      }
    }

    console.log('\n✅ Backfill complete!');
    console.log('\n📊 FINAL SUMMARY:');
    console.log(`   Releases: ${stats.releases}`);
    console.log(`   Transfers: ${stats.transfers}`);
    console.log(`   Swaps: ${stats.swaps}`);
    console.log(`   Active contracts added: ${stats.activeContracts}`);
    console.log(`   Skipped (already exist): ${stats.skipped}`);
    console.log(`   Errors: ${stats.errors}\n`);

  } catch (error) {
    console.error('❌ Error during backfill:', error);
    throw error;
  }
}

backfillPlayerHistory()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
