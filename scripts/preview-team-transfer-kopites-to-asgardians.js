/**
 * COMPREHENSIVE TEAM TRANSFER PREVIEW
 * ====================================
 * This script queries both Neon and Firebase to show EXACTLY what will be affected
 * 
 * Transfer: Kopites (SSPSLT0023) → TM Asgardians (SSPSLT0005)
 * Season: SSPSLS17
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

// Initialize Neon
const sql = neon(process.env.NEON_DATABASE_URL);

const TRANSFER = {
  fromTeamId: 'SSPSLT0023',
  fromTeamName: 'Kopites',
  toTeamId: 'SSPSLT0005',
  toTeamName: 'TM Asgardians',
  seasonId: 'SSPSLS17'
};

async function checkNeonDatabase() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║           NEON DATABASE (PostgreSQL) PREVIEW              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const results = {};

  try {
    // 1. Football Players
    console.log('📊 Checking footballplayers table...');
    const footballPlayers = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT player_id) as unique_players,
        SUM(CASE WHEN is_sold = true THEN 1 ELSE 0 END) as sold_count,
        SUM(CASE WHEN is_sold = false THEN 1 ELSE 0 END) as unsold_count,
        SUM(COALESCE(acquisition_value, 0)) as total_acquisition_value
      FROM footballplayers 
      WHERE team_id = ${TRANSFER.fromTeamId} 
      AND season_id = ${TRANSFER.seasonId}
    `;
    results.footballPlayers = footballPlayers[0];
    
    console.log(`   ✓ Total records: ${footballPlayers[0].total}`);
    console.log(`   ✓ Unique players: ${footballPlayers[0].unique_players}`);
    console.log(`   ✓ Sold: ${footballPlayers[0].sold_count} | Unsold: ${footballPlayers[0].unsold_count}`);
    console.log(`   ✓ Total acquisition value: ${footballPlayers[0].total_acquisition_value} eCoin`);

    // Get sample players
    const samplePlayers = await sql`
      SELECT name, position, team_name, acquisition_value, is_sold
      FROM footballplayers 
      WHERE team_id = ${TRANSFER.fromTeamId} 
      AND season_id = ${TRANSFER.seasonId}
      ORDER BY acquisition_value DESC NULLS LAST
      LIMIT 5
    `;
    console.log('\n   Sample players:');
    samplePlayers.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.name} (${p.position}) - ${p.acquisition_value || 0} eCoin - ${p.is_sold ? 'Sold' : 'Unsold'}`);
    });

  } catch (error) {
    console.log(`   ⚠️  Error: ${error.message}`);
    results.footballPlayers = { error: error.message };
  }

  try {
    // 2. Real Players
    console.log('\n📊 Checking realplayers table...');
    const realPlayers = await sql`
      SELECT 
        COUNT(*) as total,
        SUM(COALESCE(acquisition_value, 0)) as total_acquisition_value
      FROM realplayers 
      WHERE team_id = ${TRANSFER.fromTeamId} 
      AND season_id = ${TRANSFER.seasonId}
    `;
    results.realPlayers = realPlayers[0];
    
    console.log(`   ✓ Total records: ${realPlayers[0].total}`);
    console.log(`   ✓ Total acquisition value: ${realPlayers[0].total_acquisition_value} SSCoin`);

    if (realPlayers[0].total > 0) {
      const sampleReal = await sql`
        SELECT name, team_name, acquisition_value
        FROM realplayers 
        WHERE team_id = ${TRANSFER.fromTeamId} 
        AND season_id = ${TRANSFER.seasonId}
        ORDER BY acquisition_value DESC NULLS LAST
        LIMIT 5
      `;
      console.log('\n   Sample real players:');
      sampleReal.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.name} - ${p.acquisition_value || 0} SSCoin`);
      });
    }

  } catch (error) {
    console.log(`   ⚠️  Table may not exist or error: ${error.message}`);
    results.realPlayers = { error: error.message };
  }

  try {
    // 3. Round Players (check winning_team_id instead of team_id)
    console.log('\n📊 Checking round_players table...');
    const roundPlayers = await sql`
      SELECT COUNT(*) as total
      FROM round_players 
      WHERE winning_team_id = ${TRANSFER.fromTeamId}
    `;
    results.roundPlayers = roundPlayers[0];
    console.log(`   ✓ Total records: ${roundPlayers[0].total}`);

  } catch (error) {
    console.log(`   ⚠️  Error: ${error.message}`);
    results.roundPlayers = { error: error.message };
  }

  try {
    // 4. Round Bids
    console.log('\n📊 Checking round_bids table...');
    const roundBids = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT round_id) as unique_rounds,
        SUM(COALESCE(bid_amount, 0)) as total_bid_amount
      FROM round_bids 
      WHERE team_id = ${TRANSFER.fromTeamId}
    `;
    results.roundBids = roundBids[0];
    
    console.log(`   ✓ Total bids: ${roundBids[0].total}`);
    console.log(`   ✓ Unique rounds: ${roundBids[0].unique_rounds}`);
    console.log(`   ✓ Total bid amount: ${roundBids[0].total_bid_amount}`);

  } catch (error) {
    console.log(`   ⚠️  Error: ${error.message}`);
    results.roundBids = { error: error.message };
  }

  try {
    // 5. Starred Players
    console.log('\n📊 Checking starred_players table...');
    const starredPlayers = await sql`
      SELECT COUNT(*) as total
      FROM starred_players 
      WHERE team_id = ${TRANSFER.fromTeamId}
    `;
    results.starredPlayers = starredPlayers[0];
    console.log(`   ✓ Total starred: ${starredPlayers[0].total}`);

  } catch (error) {
    console.log(`   ⚠️  Error: ${error.message}`);
    results.starredPlayers = { error: error.message };
  }

  try {
    // 6. Player Stats
    console.log('\n📊 Checking player_stats table...');
    const playerStats = await sql`
      SELECT COUNT(*) as total
      FROM player_stats 
      WHERE team_id = ${TRANSFER.fromTeamId}
      AND season_id = ${TRANSFER.seasonId}
    `;
    results.playerStats = playerStats[0];
    console.log(`   ✓ Total records: ${playerStats[0].total}`);

  } catch (error) {
    console.log(`   ⚠️  Table may not exist: ${error.message}`);
    results.playerStats = { error: error.message };
  }

  return results;
}

async function checkFirebaseDatabase() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║              FIREBASE (Firestore) PREVIEW                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const results = {};

  try {
    // 1. Transactions
    console.log('📊 Checking transactions collection...');
    const transactionsSnapshot = await db.collection('transactions')
      .where('team_id', '==', TRANSFER.fromTeamId)
      .where('season_id', '==', TRANSFER.seasonId)
      .get();
    
    let totalIncome = 0;
    let totalExpense = 0;
    let eCoinTotal = 0;
    let sSCoinTotal = 0;
    const transactionTypes = {};

    transactionsSnapshot.forEach(doc => {
      const data = doc.data();
      const amount = data.amount || 0;
      
      if (amount > 0) totalIncome += amount;
      else totalExpense += Math.abs(amount);

      if (data.currency_type === 'football' || data.player_type === 'football') {
        eCoinTotal += amount;
      } else if (data.currency_type === 'real' || data.player_type === 'real') {
        sSCoinTotal += amount;
      }

      transactionTypes[data.transaction_type] = (transactionTypes[data.transaction_type] || 0) + 1;
    });

    results.transactions = {
      total: transactionsSnapshot.size,
      totalIncome,
      totalExpense,
      eCoinTotal,
      sSCoinTotal,
      types: transactionTypes
    };

    console.log(`   ✓ Total transactions: ${transactionsSnapshot.size}`);
    console.log(`   ✓ Total income: ${totalIncome}`);
    console.log(`   ✓ Total expense: ${totalExpense}`);
    console.log(`   ✓ eCoin net: ${eCoinTotal}`);
    console.log(`   ✓ SSCoin net: ${sSCoinTotal}`);
    console.log('\n   Transaction types:');
    Object.entries(transactionTypes).forEach(([type, count]) => {
      console.log(`     - ${type}: ${count}`);
    });

  } catch (error) {
    console.log(`   ⚠️  Error: ${error.message}`);
    results.transactions = { error: error.message };
  }

  try {
    // 2. Team Seasons
    console.log('\n📊 Checking team_seasons collection...');
    const teamSeasonsSnapshot = await db.collection('team_seasons')
      .where('team_id', '==', TRANSFER.fromTeamId)
      .where('season_id', '==', TRANSFER.seasonId)
      .get();

    if (teamSeasonsSnapshot.size > 0) {
      const teamSeasonData = teamSeasonsSnapshot.docs[0].data();
      results.teamSeasons = {
        docId: teamSeasonsSnapshot.docs[0].id,
        data: teamSeasonData
      };

      console.log(`   ✓ Found team_season document: ${teamSeasonsSnapshot.docs[0].id}`);
      console.log(`   ✓ Team name: ${teamSeasonData.team_name}`);
      console.log(`   ✓ Football budget: ${teamSeasonData.football_budget || 0}`);
      console.log(`   ✓ Football spent: ${teamSeasonData.football_spent || 0}`);
      console.log(`   ✓ Real player budget: ${teamSeasonData.real_player_budget || 0}`);
      console.log(`   ✓ Real player spent: ${teamSeasonData.real_player_spent || 0}`);
      console.log(`   ✓ Transfers used: ${teamSeasonData.transfers_used || 0}`);
    } else {
      console.log(`   ⚠️  No team_season document found`);
      results.teamSeasons = { found: false };
    }

  } catch (error) {
    console.log(`   ⚠️  Error: ${error.message}`);
    results.teamSeasons = { error: error.message };
  }

  try {
    // 3. Lineups
    console.log('\n📊 Checking lineups collection...');
    const lineupsSnapshot = await db.collection('lineups')
      .where('team_id', '==', TRANSFER.fromTeamId)
      .where('season_id', '==', TRANSFER.seasonId)
      .get();

    results.lineups = { total: lineupsSnapshot.size };
    console.log(`   ✓ Total lineups: ${lineupsSnapshot.size}`);

  } catch (error) {
    console.log(`   ⚠️  Collection may not exist: ${error.message}`);
    results.lineups = { error: error.message };
  }

  try {
    // 4. Matchups (as home or away team)
    console.log('\n📊 Checking matchups collection...');
    const homeMatchups = await db.collection('matchups')
      .where('home_team_id', '==', TRANSFER.fromTeamId)
      .where('season_id', '==', TRANSFER.seasonId)
      .get();

    const awayMatchups = await db.collection('matchups')
      .where('away_team_id', '==', TRANSFER.fromTeamId)
      .where('season_id', '==', TRANSFER.seasonId)
      .get();

    results.matchups = {
      asHome: homeMatchups.size,
      asAway: awayMatchups.size,
      total: homeMatchups.size + awayMatchups.size
    };

    console.log(`   ✓ As home team: ${homeMatchups.size}`);
    console.log(`   ✓ As away team: ${awayMatchups.size}`);
    console.log(`   ✓ Total matchups: ${homeMatchups.size + awayMatchups.size}`);

  } catch (error) {
    console.log(`   ⚠️  Collection may not exist: ${error.message}`);
    results.matchups = { error: error.message };
  }

  try {
    // 5. Player Awards
    console.log('\n📊 Checking player_awards collection...');
    const awardsSnapshot = await db.collection('player_awards')
      .where('team_id', '==', TRANSFER.fromTeamId)
      .where('season_id', '==', TRANSFER.seasonId)
      .get();

    results.playerAwards = { total: awardsSnapshot.size };
    console.log(`   ✓ Total awards: ${awardsSnapshot.size}`);

  } catch (error) {
    console.log(`   ⚠️  Collection may not exist: ${error.message}`);
    results.playerAwards = { error: error.message };
  }

  try {
    // 6. Fantasy Teams
    console.log('\n📊 Checking fantasy_teams collection...');
    const fantasySnapshot = await db.collection('fantasy_teams')
      .where('supported_team_id', '==', TRANSFER.fromTeamId)
      .get();

    results.fantasyTeams = { total: fantasySnapshot.size };
    console.log(`   ✓ Fantasy teams supporting: ${fantasySnapshot.size}`);

    if (fantasySnapshot.size > 0) {
      console.log('\n   Fantasy teams that will be affected:');
      fantasySnapshot.forEach((doc, i) => {
        const data = doc.data();
        console.log(`   ${i + 1}. ${data.team_name} (League: ${data.league_id})`);
      });
    }

  } catch (error) {
    console.log(`   ⚠️  Collection may not exist: ${error.message}`);
    results.fantasyTeams = { error: error.message };
  }

  return results;
}

function generateSummary(neonResults, firebaseResults) {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    TRANSFER SUMMARY                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log(`Transfer: ${TRANSFER.fromTeamName} (${TRANSFER.fromTeamId})`);
  console.log(`      →   ${TRANSFER.toTeamName} (${TRANSFER.toTeamId})`);
  console.log(`Season:   ${TRANSFER.seasonId}\n`);

  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('📊 NEON DATABASE IMPACT:\n');
  
  if (neonResults.footballPlayers && !neonResults.footballPlayers.error) {
    console.log(`   Football Players:     ${neonResults.footballPlayers.total} records`);
    console.log(`   - Acquisition Value:  ${neonResults.footballPlayers.total_acquisition_value} eCoin`);
  }
  
  if (neonResults.realPlayers && !neonResults.realPlayers.error) {
    console.log(`   Real Players:         ${neonResults.realPlayers.total} records`);
    console.log(`   - Acquisition Value:  ${neonResults.realPlayers.total_acquisition_value} SSCoin`);
  }
  
  if (neonResults.roundPlayers && !neonResults.roundPlayers.error) {
    console.log(`   Round Players:        ${neonResults.roundPlayers.total} records`);
  }
  
  if (neonResults.roundBids && !neonResults.roundBids.error) {
    console.log(`   Round Bids:           ${neonResults.roundBids.total} records`);
  }
  
  if (neonResults.starredPlayers && !neonResults.starredPlayers.error) {
    console.log(`   Starred Players:      ${neonResults.starredPlayers.total} records`);
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');
  console.log('🔥 FIREBASE IMPACT:\n');
  
  if (firebaseResults.transactions && !firebaseResults.transactions.error) {
    console.log(`   Transactions:         ${firebaseResults.transactions.total} documents`);
    console.log(`   - eCoin Net:          ${firebaseResults.transactions.eCoinTotal}`);
    console.log(`   - SSCoin Net:         ${firebaseResults.transactions.sSCoinTotal}`);
  }
  
  if (firebaseResults.teamSeasons && firebaseResults.teamSeasons.data) {
    console.log(`   Team Season:          1 document`);
    console.log(`   - Football Budget:    ${firebaseResults.teamSeasons.data.football_budget || 0}`);
    console.log(`   - Football Spent:     ${firebaseResults.teamSeasons.data.football_spent || 0}`);
    console.log(`   - Real Budget:        ${firebaseResults.teamSeasons.data.real_player_budget || 0}`);
    console.log(`   - Real Spent:         ${firebaseResults.teamSeasons.data.real_player_spent || 0}`);
  }
  
  if (firebaseResults.lineups && !firebaseResults.lineups.error) {
    console.log(`   Lineups:              ${firebaseResults.lineups.total} documents`);
  }
  
  if (firebaseResults.matchups && !firebaseResults.matchups.error) {
    console.log(`   Matchups:             ${firebaseResults.matchups.total} documents`);
  }
  
  if (firebaseResults.playerAwards && !firebaseResults.playerAwards.error) {
    console.log(`   Player Awards:        ${firebaseResults.playerAwards.total} documents`);
  }
  
  if (firebaseResults.fantasyTeams && !firebaseResults.fantasyTeams.error) {
    console.log(`   Fantasy Teams:        ${firebaseResults.fantasyTeams.total} documents`);
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');
}

async function main() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     COMPREHENSIVE TEAM TRANSFER PREVIEW & ANALYSIS        ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    const neonResults = await checkNeonDatabase();
    const firebaseResults = await checkFirebaseDatabase();
    
    generateSummary(neonResults, firebaseResults);

    console.log('✅ Preview complete!\n');
    console.log('⚠️  IMPORTANT: Review all numbers above before proceeding with transfer.\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during preview:', error);
    process.exit(1);
  }
}

main();
