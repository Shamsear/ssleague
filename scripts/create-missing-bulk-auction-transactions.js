/**
 * Create Missing Bulk Auction Transactions
 * 
 * This script creates the missing transaction records for bulk auction wins.
 * It ONLY creates transaction records - no budget deductions are made.
 * 
 * Run with: node scripts/create-missing-bulk-auction-transactions.js
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('FIREBASE_ADMIN_PRIVATE_KEY is not set');
  }
  
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    }),
  });
  console.log('✅ Firebase Admin initialized\n');
}

const db = admin.firestore();
const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

async function createMissingTransactions() {
  console.log('🔧 Creating missing bulk auction transactions...\n');

  try {
    // Get all completed bulk rounds
    const bulkRounds = await sql`
      SELECT id, round_number, season_id, base_price, status
      FROM rounds
      WHERE round_type = 'bulk'
      AND status = 'completed'
      ORDER BY round_number
    `;

    console.log(`📊 Found ${bulkRounds.length} completed bulk rounds\n`);

    let totalCreated = 0;
    let totalSkipped = 0;

    for (const round of bulkRounds) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📦 Round ${round.round_number} (${round.id})`);
      console.log(`${'='.repeat(80)}\n`);

      // Get all sold players in this round
      const soldPlayers = await sql`
        SELECT 
          rp.player_id,
          rp.player_name,
          rp.winning_team_id,
          rp.winning_bid,
          rp.status
        FROM round_players rp
        WHERE rp.round_id = ${round.id}
        AND rp.status = 'sold'
        AND rp.winning_team_id IS NOT NULL
        ORDER BY rp.player_name
      `;

      if (soldPlayers.length === 0) {
        console.log('   ⚠️  No sold players in this round\n');
        continue;
      }

      // For each sold player, check if transaction exists and create if missing
      for (const player of soldPlayers) {
        // Get team info from Firebase team_seasons
        const teamSeasonId = `${player.winning_team_id}_${round.season_id}`;
        const teamSeasonRef = db.collection('team_seasons').doc(teamSeasonId);
        const teamSeasonSnap = await teamSeasonRef.get();

        if (!teamSeasonSnap.exists) {
          console.log(`   ❌ Team season ${teamSeasonId} not found`);
          continue;
        }

        const teamSeasonData = teamSeasonSnap.data();
        const teamName = teamSeasonData.team_name || player.winning_team_id;

        // Check if transaction exists
        const transactionsQuery = db.collection('transactions')
          .where('team_id', '==', player.winning_team_id)
          .where('season_id', '==', round.season_id)
          .where('transaction_type', '==', 'auction_win')
          .where('metadata.player_id', '==', player.player_id)
          .where('metadata.round_id', '==', round.id);

        const transactionsSnapshot = await transactionsQuery.get();

        if (transactionsSnapshot.empty) {
          // Create the missing transaction
          const amount = player.winning_bid || round.base_price;
          
          const transactionData = {
            team_id: player.winning_team_id,
            season_id: round.season_id,
            transaction_type: 'auction_win',
            currency_type: 'football',
            amount_football: -amount, // Negative for expense
            amount_real: 0,
            description: `Auction win: ${player.player_name} (Round ${round.round_number})`,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            metadata: {
              player_id: player.player_id,
              player_name: player.player_name,
              round_id: round.id,
              round_number: round.round_number,
              backfilled: true, // Mark as backfilled
              backfilled_at: new Date().toISOString()
            }
          };

          await db.collection('transactions').add(transactionData);
          
          console.log(`   ✅ Created: ${player.player_name} → ${teamName} (£${amount})`);
          totalCreated++;
        } else {
          console.log(`   ⏭️  Skipped: ${player.player_name} → ${teamName} (already exists)`);
          totalSkipped++;
        }
      }
    }

    // Summary
    console.log(`\n${'='.repeat(80)}`);
    console.log('📋 SUMMARY');
    console.log(`${'='.repeat(80)}\n`);
    console.log(`✅ Transactions Created: ${totalCreated}`);
    console.log(`⏭️  Transactions Skipped: ${totalSkipped}`);
    console.log(`📊 Total Processed: ${totalCreated + totalSkipped}\n`);

    if (totalCreated > 0) {
      console.log('✅ All missing transactions have been created!');
      console.log('💡 Note: Only transaction records were created. No budget deductions were made.\n');
    } else {
      console.log('ℹ️  No missing transactions found. All transactions already exist.\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run the script
createMissingTransactions()
  .then(() => {
    console.log('\n✅ Script complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
