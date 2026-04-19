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

const SEASON_ID = 'SSPSLS17';
const ROUNDS = ['SSPSLFBR00008', 'SSPSLFBR00009'];

async function createBulkRoundTransactions() {
  console.log('🚀 Creating Missing Transactions for Bulk Rounds...\n');
  console.log(`   Rounds: ${ROUNDS.join(', ')}`);
  console.log(`   Season: ${SEASON_ID}\n`);

  try {
    // Get all teams with their firebase_uid
    const teams = await sql`
      SELECT id, name, firebase_uid
      FROM teams
      WHERE season_id = ${SEASON_ID}
    `;

    const teamMap = new Map();
    teams.forEach(team => {
      teamMap.set(team.id, {
        name: team.name,
        firebase_uid: team.firebase_uid
      });
    });

    console.log(`📊 Loaded ${teams.length} teams\n`);

    let totalTransactions = 0;
    let skippedTransactions = 0;
    let errorCount = 0;

    // Process each round
    for (const roundId of ROUNDS) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📋 Processing Round: ${roundId}`);
      console.log('='.repeat(60));

      // Get all sold players in this round
      const soldPlayers = await sql`
        SELECT 
          rp.player_id,
          rp.player_name,
          rp.winning_team_id,
          rp.winning_bid,
          rp.round_id
        FROM round_players rp
        WHERE rp.round_id = ${roundId}
        AND rp.status = 'sold'
        AND rp.winning_team_id IS NOT NULL
        ORDER BY rp.winning_team_id, rp.player_name
      `;

      console.log(`\n   Found ${soldPlayers.length} sold players\n`);

      if (soldPlayers.length === 0) {
        console.log(`   ⚠️  No sold players found in this round\n`);
        continue;
      }

      // Group by team
      const playersByTeam = new Map();
      soldPlayers.forEach(player => {
        if (!playersByTeam.has(player.winning_team_id)) {
          playersByTeam.set(player.winning_team_id, []);
        }
        playersByTeam.get(player.winning_team_id).push(player);
      });

      // Process each team
      for (const [teamId, players] of playersByTeam.entries()) {
        const teamInfo = teamMap.get(teamId);
        
        if (!teamInfo) {
          console.log(`   ❌ Team ${teamId} not found in teams table`);
          errorCount++;
          continue;
        }

        if (!teamInfo.firebase_uid) {
          console.log(`   ❌ Team ${teamId} (${teamInfo.name}) has no firebase_uid`);
          errorCount++;
          continue;
        }

        console.log(`\n   🏆 ${teamInfo.name} (${teamId})`);
        console.log(`      Players: ${players.length}`);

        // Get current team_season to calculate balance
        const teamSeasonId = `${teamId}_${SEASON_ID}`;
        const teamSeasonRef = db.collection('team_seasons').doc(teamSeasonId);
        const teamSeasonSnap = await teamSeasonRef.get();

        if (!teamSeasonSnap.exists) {
          console.log(`      ❌ team_season ${teamSeasonId} not found in Firebase`);
          errorCount++;
          continue;
        }

        const teamSeasonData = teamSeasonSnap.data();
        const currencySystem = teamSeasonData?.currency_system || 'single';
        const isDualCurrency = currencySystem === 'dual';

        // Get current budget
        let currentBalance = isDualCurrency
          ? (teamSeasonData?.football_budget || 0)
          : (teamSeasonData?.budget || 0);

        console.log(`      Current balance: £${currentBalance.toFixed(2)}`);

        // Process each player
        for (const player of players) {
          const amount = parseFloat(player.winning_bid) || 10;

          // Check if transaction already exists
          const existingTxns = await db.collection('transactions')
            .where('userId', '==', teamInfo.firebase_uid)
            .where('seasonId', '==', SEASON_ID)
            .where('type', '==', 'auction_win')
            .get();

          const hasExisting = existingTxns.docs.some(doc => {
            const metadata = doc.data().metadata || {};
            return metadata.playerId === player.player_id && metadata.roundId === roundId;
          });

          if (hasExisting) {
            console.log(`      ⏭️  ${player.player_name} - transaction already exists`);
            skippedTransactions++;
            continue;
          }

          // Calculate balances
          const balanceBefore = currentBalance;
          const balanceAfter = currentBalance - amount;

          // Create transaction
          const transactionData = {
            userId: teamInfo.firebase_uid,
            seasonId: SEASON_ID,
            type: 'auction_win',
            category: 'football',
            amount: -amount,
            balanceBefore: balanceBefore,
            balanceAfter: balanceAfter,
            description: `Won ${player.player_name} in auction`,
            metadata: {
              playerId: player.player_id,
              playerName: player.player_name,
              roundId: roundId,
              bidAmount: amount,
            },
            createdAt: new Date(),
          };

          try {
            const transactionRef = await db.collection('transactions').add(transactionData);
            console.log(`      ✅ ${player.player_name} - £${amount} (txn: ${transactionRef.id})`);
            
            // Update current balance for next transaction
            currentBalance = balanceAfter;
            totalTransactions++;
          } catch (error) {
            console.error(`      ❌ Failed to create transaction for ${player.player_name}:`, error.message);
            errorCount++;
          }
        }
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 Summary');
    console.log('='.repeat(60));
    console.log(`   ✅ Transactions created: ${totalTransactions}`);
    console.log(`   ⏭️  Transactions skipped (already exist): ${skippedTransactions}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log('');

    if (totalTransactions > 0) {
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

createBulkRoundTransactions();
