/**
 * Create salary deduction transactions for Red Hawks FC
 * Rounds 1-4
 * 
 * This script mimics the exact behavior of /api/realplayers/update-points
 * which deducts salaries when match results are submitted.
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
const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

/**
 * Log salary payment transaction (mimics logTransaction from transaction-logger)
 */
async function logSalaryPayment(teamId, seasonId, salary, currentBalance, playerId, playerName, fixtureId, roundNumber) {
  const newBalance = currentBalance - salary;
  
  const transactionData = {
    team_id: teamId,
    season_id: seasonId,
    transaction_type: 'salary_payment',
    currency_type: 'real_player',
    amount: -salary, // NEGATIVE (deduction)
    balance_before: currentBalance,
    balance_after: newBalance,
    description: `Salary: ${playerName}`,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
    metadata: {
      fixture_id: fixtureId,
      player_id: playerId,
      player_name: playerName,
      salary_amount: salary,
      round_number: roundNumber,
      player_count: 1,
    }
  };
  
  await db.collection('transactions').add(transactionData);
  return newBalance;
}

async function createSalaryTransactions() {
  try {
    console.log('🔍 Finding Red Hawks FC team...');
    
    // Find Red Hawks FC team_season
    const teamSeasonsSnapshot = await db.collection('team_seasons')
      .where('team_name', '==', 'Red Hawks FC')
      .where('status', '==', 'registered')
      .get();
    
    if (teamSeasonsSnapshot.empty) {
      console.error('❌ Red Hawks FC team_season not found');
      return;
    }
    
    const teamSeasonDoc = teamSeasonsSnapshot.docs[0];
    const teamSeasonData = teamSeasonDoc.data();
    const teamId = teamSeasonData.team_id;
    const seasonId = teamSeasonData.season_id;
    
    console.log(`✅ Found team: ${teamSeasonData.team_name}`);
    console.log(`   Team ID: ${teamId}`);
    console.log(`   Season ID: ${seasonId}`);
    console.log(`   Current real_player_budget: ${teamSeasonData.real_player_budget || 0}`);
    
    // Get fixtures for rounds 1-4 from Neon
    console.log('\n🔍 Finding fixtures for rounds 1-4...');
    
    const fixtures = await sql`
      SELECT id, round_number, home_team_id, away_team_id, status, home_score, away_score, season_id
      FROM fixtures
      WHERE season_id = ${seasonId}
      AND round_number IN (1, 2, 3, 4)
      AND (home_team_id = ${teamId} OR away_team_id = ${teamId})
      ORDER BY round_number ASC
    `;
    
    console.log(`   Found ${fixtures.length} fixtures for Red Hawks FC in rounds 1-4`);
    
    if (fixtures.length === 0) {
      console.error('❌ No fixtures found for Red Hawks FC in rounds 1-4');
      return;
    }
    
    fixtures.forEach(f => {
      console.log(`   - Round ${f.round_number}: ${f.id} (status: ${f.status || 'unknown'}, score: ${f.home_score}-${f.away_score})`);
    });
    
    let currentBalance = teamSeasonData.real_player_budget || 0;
    let totalDeducted = 0;
    let totalTransactions = 0;
    
    // Process each fixture
    for (const fixture of fixtures) {
      const fixtureId = fixture.id;
      const roundNumber = fixture.round_number;
      
      console.log(`\n📋 Processing fixture: ${fixtureId}`);
      console.log(`   Round: ${roundNumber}`);
      console.log(`   Score: ${fixture.home_score} - ${fixture.away_score}`);
      
      // Check if transactions already exist
      const existingTxns = await db.collection('transactions')
        .where('team_id', '==', teamId)
        .where('transaction_type', 'in', ['salary', 'salary_payment'])
        .get();
      
      const hasExisting = existingTxns.docs.some(doc => {
        const metadata = doc.data().metadata || {};
        return metadata.fixture_id === fixtureId;
      });
      
      if (hasExisting) {
        console.log(`   ⚠️  Transactions already exist for this fixture - SKIPPING`);
        continue;
      }
      
      // Get matchups to find which players played
      const matchups = await sql`
        SELECT home_player_id, home_player_name, away_player_id, away_player_name
        FROM matchups
        WHERE fixture_id = ${fixtureId}
        ORDER BY position ASC
      `;
      
      if (matchups.length === 0) {
        console.log(`   ⚠️  No matchups found - SKIPPING`);
        continue;
      }
      
      console.log(`   Found ${matchups.length} matchups`);
      
      // Collect all player IDs for this team
      const playerIds = new Set();
      matchups.forEach(matchup => {
        // Determine if Red Hawks was home or away
        if (fixture.home_team_id === teamId) {
          playerIds.add(matchup.home_player_id);
        } else {
          playerIds.add(matchup.away_player_id);
        }
      });
      
      console.log(`   Red Hawks FC players: ${playerIds.size}`);
      
      // Get player details from player_seasons in Neon
      const playerIdsArray = Array.from(playerIds);
      const playerSeasonIds = playerIdsArray.map(pid => `${pid}_${seasonId}`);
      
      const players = await sql`
        SELECT id, player_id, player_name, team_id, salary_per_match
        FROM player_seasons
        WHERE id = ANY(${playerSeasonIds})
      `;
      
      console.log(`   Found ${players.length} player records`);
      
      // Create salary transactions
      console.log(`\n   💰 Creating salary transactions...`);
      
      for (const player of players) {
        const salary = parseFloat(player.salary_per_match) || 0;
        
        if (salary <= 0) {
          console.log(`   ⏭️  ${player.player_name}: salary is ${salary} - SKIPPING`);
          continue;
        }
        
        // Log transaction and update balance
        currentBalance = await logSalaryPayment(
          teamId,
          seasonId,
          salary,
          currentBalance,
          player.player_id,
          player.player_name,
          fixtureId,
          roundNumber
        );
        
        totalDeducted += salary;
        totalTransactions++;
        
        console.log(`   ✅ ${player.player_name}: -${salary.toFixed(2)} (balance: ${currentBalance.toFixed(2)})`);
      }
    }
    
    // Update team_season with new balance
    console.log(`\n💰 Updating team balance...`);
    console.log(`   Old balance: ${teamSeasonData.real_player_budget || 0}`);
    console.log(`   Total deducted: ${totalDeducted.toFixed(2)}`);
    console.log(`   New balance: ${currentBalance.toFixed(2)}`);
    
    await db.collection('team_seasons').doc(teamSeasonDoc.id).update({
      real_player_budget: currentBalance,
      updated_at: new Date()
    });
    
    console.log(`\n✅ COMPLETE!`);
    console.log(`   Transactions created: ${totalTransactions}`);
    console.log(`   Total salary deducted: ${totalDeducted.toFixed(2)}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

createSalaryTransactions();
