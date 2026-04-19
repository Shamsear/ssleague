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
const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

const ROUND_ID = process.argv[2] || 'SSPSLFBR00009';

async function createMissingTiebreakerTransactions() {
  console.log(`\n🚀 Creating Missing Tiebreaker Transactions for Round: ${ROUND_ID}\n`);

  try {
    // Get all resolved tiebreakers for this round
    const tiebreakers = await sql`
      SELECT 
        bt.id,
        bt.player_id,
        bt.player_name,
        bt.current_highest_team_id,
        bt.current_highest_bid,
        bt.season_id,
        bt.status,
        bt.resolved_at
      FROM bulk_tiebreakers bt
      WHERE bt.bulk_round_id = ${ROUND_ID}
      AND bt.status IN ('resolved', 'finalized')
      AND bt.current_highest_team_id IS NOT NULL
      ORDER BY bt.resolved_at ASC
    `;

    if (tiebreakers.length === 0) {
      console.log(`⚠️  No resolved tiebreakers found for round ${ROUND_ID}\n`);
      return;
    }

    console.log(`📊 Found ${tiebreakers.length} resolved tiebreaker(s)\n`);

    let transactionsCreated = 0;
    let transactionsSkipped = 0;
    let errors = 0;

    for (const tb of tiebreakers) {
      console.log(`\n🎯 Processing: ${tb.player_name} (${tb.player_id})`);
      console.log(`   Winner: ${tb.current_highest_team_id}`);
      console.log(`   Amount: £${tb.current_highest_bid}`);

      // Get team firebase_uid
      const teamResult = await sql`
        SELECT firebase_uid, name
        FROM teams
        WHERE id = ${tb.current_highest_team_id}
        AND season_id = ${tb.season_id}
        LIMIT 1
      `;

      if (teamResult.length === 0) {
        console.log(`   ❌ Team ${tb.current_highest_team_id} not found`);
        errors++;
        continue;
      }

      const team = teamResult[0];
      const firebaseUid = team.firebase_uid;
      const teamName = team.name;

      if (!firebaseUid) {
        console.log(`   ❌ No firebase_uid for team ${tb.current_highest_team_id}`);
        errors++;
        continue;
      }

      // Check if transaction already exists
      const existingTxns = await db.collection('transactions')
        .where('userId', '==', firebaseUid)
        .where('seasonId', '==', tb.season_id)
        .where('type', '==', 'auction_win')
        .get();

      const hasExisting = existingTxns.docs.some(doc => {
        const metadata = doc.data().metadata || {};
        return metadata.playerId === tb.player_id;
      });

      if (hasExisting) {
        console.log(`   ⏭️  Transaction already exists`);
        transactionsSkipped++;
        continue;
      }

      // Get current team_season to calculate balance
      const teamSeasonId = `${tb.current_highest_team_id}_${tb.season_id}`;
      const teamSeasonSnap = await db.collection('team_seasons').doc(teamSeasonId).get();

      if (!teamSeasonSnap.exists) {
        console.log(`   ❌ team_season ${teamSeasonId} not found in Firebase`);
        errors++;
        continue;
      }

      const teamSeasonData = teamSeasonSnap.data();
      const currencySystem = teamSeasonData?.currency_system || 'single';
      const isDualCurrency = currencySystem === 'dual';

      // Get current budget
      const currentBudget = isDualCurrency
        ? (teamSeasonData?.football_budget || 0)
        : (teamSeasonData?.budget || 0);

      // Calculate balances (transaction shows the state AFTER the purchase)
      // So we need to add back the amount to get the balance BEFORE
      const balanceBefore = currentBudget + tb.current_highest_bid;
      const balanceAfter = currentBudget;

      // Create transaction
      const transactionData = {
        userId: firebaseUid,
        seasonId: tb.season_id,
        type: 'auction_win',
        category: 'football',
        amount: -tb.current_highest_bid,
        balanceBefore: balanceBefore,
        balanceAfter: balanceAfter,
        description: `Won ${tb.player_name} in auction`,
        metadata: {
          playerId: tb.player_id,
          playerName: tb.player_name,
          roundId: ROUND_ID,
          tiebreakerId: tb.id,
          bidAmount: tb.current_highest_bid,
        },
        createdAt: tb.resolved_at ? new Date(tb.resolved_at) : new Date(),
      };

      try {
        const transactionRef = await db.collection('transactions').add(transactionData);
        console.log(`   ✅ Transaction created (ID: ${transactionRef.id})`);
        console.log(`      Balance: £${balanceBefore.toFixed(2)} → £${balanceAfter.toFixed(2)}`);
        transactionsCreated++;
      } catch (error) {
        console.error(`   ❌ Failed to create transaction:`, error.message);
        errors++;
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 Summary');
    console.log('='.repeat(60));
    console.log(`   ✅ Transactions created: ${transactionsCreated}`);
    console.log(`   ⏭️  Transactions skipped (already exist): ${transactionsSkipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log('');

    if (transactionsCreated > 0) {
      console.log('🎉 Transaction creation complete!\n');
    } else {
      console.log('⚠️  No new transactions were created\n');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

createMissingTiebreakerTransactions();
