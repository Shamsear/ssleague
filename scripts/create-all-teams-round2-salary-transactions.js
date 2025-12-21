/**
 * Create salary deduction transactions for ALL TEAMS
 * Round 2 ONLY
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
async function logSalaryPayment(teamId, seasonId, salary, currentBalance, currentSpent, playerId, playerName, fixtureId, roundNumber) {
  const newBalance = currentBalance - salary;
  const newSpent = currentSpent + salary;
  
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
  return { newBalance, newSpent };
}

async function processTeam(teamSeasonDoc, seasonId) {
  const teamSeasonData = teamSeasonDoc.data();
  const teamId = teamSeasonData.team_id;
  const teamName = teamSeasonData.team_name;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 Processing: ${teamName}`);
  console.log(`   Team ID: ${teamId}`);
  console.log(`   Current balance: ${teamSeasonData.real_player_budget || 0}`);
  console.log(`   Current spent: ${teamSeasonData.real_player_spent || 0}`);
  
  // Get fixture for round 2 from Neon
  const fixtures = await sql`
    SELECT id, round_number, home_team_id, away_team_id, status, home_score, away_score, season_id
    FROM fixtures
    WHERE season_id = ${seasonId}
    AND round_number = 2
    AND (home_team_id = ${teamId} OR away_team_id = ${teamId})
    LIMIT 1
  `;
  
  if (fixtures.length === 0) {
    console.log(`   ⚠️  No fixture found for round 2 - SKIPPING`);
    return { processed: false, reason: 'no_fixture' };
  }
  
  const fixture = fixtures[0];
  const fixtureId = fixture.id;
  
  console.log(`   Fixture: ${fixtureId}`);
  console.log(`   Score: ${fixture.home_score} - ${fixture.away_score}`);
  console.log(`   Status: ${fixture.status || 'unknown'}`);
  
  // Check if transactions already exist
  const existingTxns = await db.collection('transactions')
    .where('team_id', '==', teamId)
    .where('transaction_type', 'in', ['salary', 'salary_payment'])
    .get();
  
  const hasExisting = existingTxns.docs.some(doc => {
    const metadata = doc.data().metadata || {};
    return metadata.fixture_id === fixtureId && metadata.round_number === 2;
  });
  
  if (hasExisting) {
    console.log(`   ⚠️  Transactions already exist for round 2 - SKIPPING`);
    return { processed: false, reason: 'already_exists' };
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
    return { processed: false, reason: 'no_matchups' };
  }
  
  console.log(`   Matchups: ${matchups.length}`);
  
  // Collect all player IDs for this team
  const playerIds = new Set();
  matchups.forEach(matchup => {
    if (fixture.home_team_id === teamId) {
      playerIds.add(matchup.home_player_id);
    } else {
      playerIds.add(matchup.away_player_id);
    }
  });
  
  console.log(`   Players: ${playerIds.size}`);
  
  // Get player details from player_seasons in Neon
  const playerIdsArray = Array.from(playerIds);
  const playerSeasonIds = playerIdsArray.map(pid => `${pid}_${seasonId}`);
  
  const players = await sql`
    SELECT id, player_id, player_name, team_id, salary_per_match
    FROM player_seasons
    WHERE id = ANY(${playerSeasonIds})
  `;
  
  if (players.length === 0) {
    console.log(`   ⚠️  No player records found - SKIPPING`);
    return { processed: false, reason: 'no_players' };
  }
  
  // Create salary transactions
  let currentBalance = teamSeasonData.real_player_budget || 0;
  let currentSpent = teamSeasonData.real_player_spent || 0;
  let totalDeducted = 0;
  let transactionCount = 0;
  
  console.log(`\n   💰 Creating salary transactions...`);
  
  for (const player of players) {
    const salary = parseFloat(player.salary_per_match) || 0;
    
    if (salary <= 0) {
      console.log(`      ⏭️  ${player.player_name}: salary is ${salary} - SKIPPING`);
      continue;
    }
    
    // Log transaction and update balance + spent
    const result = await logSalaryPayment(
      teamId,
      seasonId,
      salary,
      currentBalance,
      currentSpent,
      player.player_id,
      player.player_name,
      fixtureId,
      2 // round number
    );
    
    currentBalance = result.newBalance;
    currentSpent = result.newSpent;
    totalDeducted += salary;
    transactionCount++;
    
    console.log(`      ✅ ${player.player_name}: -${salary.toFixed(2)} (balance: ${currentBalance.toFixed(2)}, spent: ${currentSpent.toFixed(2)})`);
  }
  
  // Update team_season with new balance AND spent
  await db.collection('team_seasons').doc(teamSeasonDoc.id).update({
    real_player_budget: currentBalance,
    real_player_spent: currentSpent,
    updated_at: new Date()
  });
  
  console.log(`\n   ✅ ${teamName} COMPLETE!`);
  console.log(`      Transactions: ${transactionCount}`);
  console.log(`      Total deducted: ${totalDeducted.toFixed(2)}`);
  console.log(`      New balance: ${currentBalance.toFixed(2)}`);
  console.log(`      New spent: ${currentSpent.toFixed(2)}`);
  
  return {
    processed: true,
    teamName,
    transactionCount,
    totalDeducted,
    oldBalance: teamSeasonData.real_player_budget || 0,
    newBalance: currentBalance,
    oldSpent: teamSeasonData.real_player_spent || 0,
    newSpent: currentSpent
  };
}

async function createAllTeamsSalaryTransactions() {
  try {
    const seasonId = 'SSPSLS16';
    
    console.log('🔍 Finding all registered teams for season:', seasonId);
    console.log('🎯 Processing ROUND 2 ONLY\n');
    
    // Find all registered team_seasons
    const teamSeasonsSnapshot = await db.collection('team_seasons')
      .where('season_id', '==', seasonId)
      .where('status', '==', 'registered')
      .get();
    
    if (teamSeasonsSnapshot.empty) {
      console.error('❌ No registered teams found');
      return;
    }
    
    console.log(`✅ Found ${teamSeasonsSnapshot.size} registered teams\n`);
    
    const results = {
      processed: [],
      skipped: [],
      errors: []
    };
    
    // Process each team
    for (const teamSeasonDoc of teamSeasonsSnapshot.docs) {
      try {
        const result = await processTeam(teamSeasonDoc, seasonId);
        
        if (result.processed) {
          results.processed.push(result);
        } else {
          results.skipped.push({
            teamName: teamSeasonDoc.data().team_name,
            reason: result.reason
          });
        }
      } catch (error) {
        console.error(`   ❌ Error processing ${teamSeasonDoc.data().team_name}:`, error.message);
        results.errors.push({
          teamName: teamSeasonDoc.data().team_name,
          error: error.message
        });
      }
    }
    
    // Print summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 SUMMARY - ROUND 2');
    console.log(`${'='.repeat(60)}`);
    
    console.log(`\n✅ Successfully Processed (${results.processed.length} teams):`);
    results.processed.forEach(r => {
      console.log(`   • ${r.teamName}: ${r.transactionCount} txns, -${r.totalDeducted.toFixed(2)} SSCoin`);
      console.log(`     Balance: ${r.oldBalance} → ${r.newBalance.toFixed(2)}`);
      console.log(`     Spent: ${r.oldSpent.toFixed(2)} → ${r.newSpent.toFixed(2)}`);
    });
    
    if (results.skipped.length > 0) {
      console.log(`\n⏭️  Skipped (${results.skipped.length} teams):`);
      results.skipped.forEach(r => {
        console.log(`   • ${r.teamName}: ${r.reason}`);
      });
    }
    
    if (results.errors.length > 0) {
      console.log(`\n❌ Errors (${results.errors.length} teams):`);
      results.errors.forEach(r => {
        console.log(`   • ${r.teamName}: ${r.error}`);
      });
    }
    
    const totalTransactions = results.processed.reduce((sum, r) => sum + r.transactionCount, 0);
    const totalDeducted = results.processed.reduce((sum, r) => sum + r.totalDeducted, 0);
    
    console.log(`\n📈 Totals:`);
    console.log(`   Teams processed: ${results.processed.length}`);
    console.log(`   Total transactions: ${totalTransactions}`);
    console.log(`   Total SSCoin deducted: ${totalDeducted.toFixed(2)}`);
    
    console.log(`\n✅ ALL DONE!`);
    
  } catch (error) {
    console.error('❌ Fatal Error:', error);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

createAllTeamsSalaryTransactions();
