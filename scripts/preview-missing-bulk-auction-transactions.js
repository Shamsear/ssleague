/**
 * Preview Missing Bulk Auction Transactions
 * 
 * This script analyzes bulk auction rounds and identifies missing transactions
 * that should have been created during finalization.
 * 
 * Run with: node scripts/preview-missing-bulk-auction-transactions.js
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

async function previewMissingTransactions() {
  console.log('🔍 Starting preview of missing bulk auction transactions...\n');

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

    const missingTransactions = [];
    let totalMissing = 0;

    for (const round of bulkRounds) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📦 Round ${round.round_number} (${round.id})`);
      console.log(`   Season: ${round.season_id}`);
      console.log(`   Base Price: £${round.base_price}`);
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

      console.log(`   ✅ Found ${soldPlayers.length} sold players\n`);

      if (soldPlayers.length === 0) {
        console.log('   ⚠️  No sold players in this round\n');
        continue;
      }

      // For each sold player, check if transaction exists
      for (const player of soldPlayers) {
        // Get team info from Firebase team_seasons instead of Neon teams
        const teamSeasonId = `${player.winning_team_id}_${round.season_id}`;
        const teamSeasonRef = db.collection('team_seasons').doc(teamSeasonId);
        const teamSeasonSnap = await teamSeasonRef.get();

        if (!teamSeasonSnap.exists) {
          console.log(`   ❌ Team season ${teamSeasonId} not found in Firebase`);
          continue;
        }

        const teamSeasonData = teamSeasonSnap.data();
        const teamName = teamSeasonData.team_name || player.winning_team_id;

        // Check if transaction exists in Firebase
        const transactionsQuery = db.collection('transactions')
          .where('team_id', '==', player.winning_team_id)
          .where('season_id', '==', round.season_id)
          .where('transaction_type', '==', 'auction_win')
          .where('metadata.player_id', '==', player.player_id)
          .where('metadata.round_id', '==', round.id);

        const transactionsSnapshot = await transactionsQuery.get();

        if (transactionsSnapshot.empty) {
          // Transaction is missing!
          console.log(`   ❌ MISSING: ${player.player_name} → ${teamName} (£${player.winning_bid || round.base_price})`);
          
          missingTransactions.push({
            round_id: round.id,
            round_number: round.round_number,
            season_id: round.season_id,
            player_id: player.player_id,
            player_name: player.player_name,
            team_id: player.winning_team_id,
            team_name: teamName,
            amount: player.winning_bid || round.base_price,
            base_price: round.base_price
          });
          
          totalMissing++;
        } else {
          console.log(`   ✓ Found: ${player.player_name} → ${teamName}`);
        }
      }
    }

    // Summary
    console.log(`\n${'='.repeat(80)}`);
    console.log('📋 SUMMARY');
    console.log(`${'='.repeat(80)}\n`);
    console.log(`Total Missing Transactions: ${totalMissing}\n`);

    if (totalMissing > 0) {
      console.log('Missing transactions by round:\n');
      
      const byRound = {};
      for (const txn of missingTransactions) {
        if (!byRound[txn.round_number]) {
          byRound[txn.round_number] = [];
        }
        byRound[txn.round_number].push(txn);
      }

      for (const [roundNum, txns] of Object.entries(byRound)) {
        console.log(`\n📦 Round ${roundNum}: ${txns.length} missing transactions`);
        for (const txn of txns) {
          console.log(`   • ${txn.player_name} → ${txn.team_name} (£${txn.amount})`);
        }
      }

      console.log(`\n${'='.repeat(80)}`);
      console.log('💾 WHAT WOULD BE CREATED:');
      console.log(`${'='.repeat(80)}\n`);

      for (const txn of missingTransactions) {
        console.log(`Transaction for ${txn.team_name}:`);
        console.log(`  {`);
        console.log(`    team_id: "${txn.team_id}",`);
        console.log(`    season_id: "${txn.season_id}",`);
        console.log(`    transaction_type: "auction_win",`);
        console.log(`    currency_type: "football",`);
        console.log(`    amount: ${txn.amount},`);
        console.log(`    description: "Auction win: ${txn.player_name} (Round ${txn.round_number})",`);
        console.log(`    metadata: {`);
        console.log(`      player_id: "${txn.player_id}",`);
        console.log(`      player_name: "${txn.player_name}",`);
        console.log(`      round_id: "${txn.round_id}",`);
        console.log(`      round_number: ${txn.round_number}`);
        console.log(`    }`);
        console.log(`  }\n`);
      }

      console.log(`\n${'='.repeat(80)}`);
      console.log('⚠️  NEXT STEPS:');
      console.log(`${'='.repeat(80)}\n`);
      console.log('1. Review the missing transactions above');
      console.log('2. If everything looks correct, run:');
      console.log('   node scripts/create-missing-bulk-auction-transactions.js');
      console.log('3. This will create the missing transactions in Firebase\n');
    } else {
      console.log('✅ All transactions are present! No missing transactions found.\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run the preview
previewMissingTransactions()
  .then(() => {
    console.log('\n✅ Preview complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Preview failed:', error);
    process.exit(1);
  });
