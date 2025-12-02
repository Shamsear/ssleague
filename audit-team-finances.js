/**
 * Audit Team Finances and Player Counts
 * 
 * This script checks for discrepancies between:
 * 1. Actual player spending (from footballplayers table)
 * 2. Team spending records (in teams table and Firebase)
 * 3. Position counts and player counts
 */

const { neon } = require('@neondatabase/serverless');
const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin (same as lib/firebase/admin.ts)
if (!admin.apps.length) {
  try {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
    
    if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || `https://${process.env.FIREBASE_ADMIN_PROJECT_ID}-default-rtdb.firebaseio.com`,
      });
      console.log('✅ Firebase Admin initialized with service account\n');
    } else if (projectId) {
      admin.initializeApp({
        projectId: projectId,
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || `https://${projectId}-default-rtdb.firebaseio.com`,
      });
      console.log(`✅ Firebase Admin initialized with project ID: ${projectId}\n`);
    } else {
      admin.initializeApp();
      console.log('✅ Firebase Admin initialized with default credentials\n');
    }
  } catch (error) {
    console.error('❌ Firebase admin initialization error:', error);
    throw new Error('Failed to initialize Firebase Admin SDK');
  }
}

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);
const tournamentSql = neon(process.env.TOURNAMENT_DATABASE_URL || process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);
const db = admin.firestore();

async function auditTeamFinances() {
  console.log('🔍 Starting Team Finance Audit...\n');

  try {
    // Get all teams with their season info
    const teams = await sql`
      SELECT 
        id,
        name,
        season_id,
        football_budget,
        football_spent,
        football_players_count,
        firebase_uid
      FROM teams
      ORDER BY season_id, name
    `;

    console.log(`📊 Found ${teams.length} teams to audit\n`);

    const discrepancies = [];

    for (const team of teams) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🏆 Team: ${team.name} (${team.id})`);
      console.log(`   Season: ${team.season_id}`);
      console.log(`${'='.repeat(80)}`);

      // 1. Calculate actual spending from footballplayers table
      const actualSpending = await sql`
        SELECT 
          COUNT(*) as player_count,
          COALESCE(SUM(acquisition_value), 0) as total_spent,
          json_agg(
            json_build_object(
              'id', id,
              'name', name,
              'position', position,
              'price', acquisition_value,
              'round_id', round_id
            )
          ) as players
        FROM footballplayers
        WHERE team_id = ${team.id}
        AND season_id = ${team.season_id}
        AND is_sold = true
      `;

      const actual = actualSpending[0];
      const actualCount = parseInt(actual.player_count) || 0;
      const actualSpent = parseFloat(actual.total_spent) || 0;
      const players = actual.players || [];

      console.log(`\n📋 ACTUAL DATA (from footballplayers table):`);
      console.log(`   Players: ${actualCount}`);
      console.log(`   Total Spent: £${actualSpent.toFixed(2)}`);

      // Calculate position counts
      const positionCounts = {};
      if (players && players[0]) {
        players.forEach(p => {
          if (p.position) {
            positionCounts[p.position] = (positionCounts[p.position] || 0) + 1;
          }
        });
      }
      console.log(`   Position Counts:`, positionCounts);

      // 2. Get recorded data from teams table (Neon)
      console.log(`\n📊 RECORDED DATA (from teams table):`);
      console.log(`   Players Count: ${team.football_players_count || 0}`);
      console.log(`   Football Spent: £${(team.football_spent || 0).toFixed(2)}`);
      console.log(`   Football Budget: £${(team.football_budget || 0).toFixed(2)}`);

      // 3. Get real players count from tournament database
      const realPlayersResult = await tournamentSql`
        SELECT COUNT(*) as count
        FROM player_seasons
        WHERE team_id = ${team.id}
        AND season_id = ${team.season_id}
      `;
      
      const realPlayersCount = parseInt(realPlayersResult[0]?.count || 0);
      const expectedTotalPlayers = actualCount + realPlayersCount;

      console.log(`\n👥 REAL PLAYERS (from Firebase realplayers):`);
      console.log(`   Real Players Count: ${realPlayersCount}`);
      console.log(`   Expected Total (Football + Real): ${expectedTotalPlayers}`);

      // 4. Get Firebase data
      const teamSeasonId = `${team.id}_${team.season_id}`;
      const teamSeasonDoc = await db.collection('team_seasons').doc(teamSeasonId).get();
      
      let firebaseData = null;
      if (teamSeasonDoc.exists) {
        firebaseData = teamSeasonDoc.data();
        console.log(`\n🔥 FIREBASE DATA (team_seasons/${teamSeasonId}):`);
        console.log(`   Players Count: ${firebaseData.players_count || 0} (should be ${expectedTotalPlayers})`);
        console.log(`   Total Spent: £${(firebaseData.total_spent || 0).toFixed(2)}`);
        console.log(`   Football Spent: £${(firebaseData.football_spent || 0).toFixed(2)}`);
        console.log(`   Football Budget: £${(firebaseData.football_budget || 0).toFixed(2)}`);
        console.log(`   Budget (single): £${(firebaseData.budget || 0).toFixed(2)}`);
        console.log(`   Currency System: ${firebaseData.currency_system || 'single'}`);
        console.log(`   Position Counts:`, firebaseData.position_counts || {});
      } else {
        console.log(`\n⚠️  FIREBASE: No team_seasons document found`);
      }

      // 5. Check for discrepancies
      const neonPlayerCountMatch = actualCount === (team.football_players_count || 0);
      const neonSpentMatch = Math.abs(actualSpent - (team.football_spent || 0)) < 0.01;
      
      let firebasePlayerCountMatch = true;
      let firebaseSpentMatch = true;
      let firebasePositionMatch = true;
      
      if (firebaseData) {
        // Firebase players_count should be football players + real players
        firebasePlayerCountMatch = expectedTotalPlayers === (firebaseData.players_count || 0);
        const firebaseSpent = firebaseData.currency_system === 'dual' 
          ? (firebaseData.football_spent || 0)
          : (firebaseData.total_spent || 0);
        firebaseSpentMatch = Math.abs(actualSpent - firebaseSpent) < 0.01;
        
        // Check position counts
        const fbPositionCounts = firebaseData.position_counts || {};
        firebasePositionMatch = JSON.stringify(positionCounts) === JSON.stringify(fbPositionCounts);
      }

      const hasDiscrepancy = !neonPlayerCountMatch || !neonSpentMatch || 
                            !firebasePlayerCountMatch || !firebaseSpentMatch || 
                            !firebasePositionMatch;

      if (hasDiscrepancy) {
        console.log(`\n❌ DISCREPANCIES FOUND:`);
        
        if (!neonPlayerCountMatch) {
          console.log(`   ⚠️  Neon Player Count: Expected ${actualCount}, Got ${team.football_players_count || 0}`);
        }
        if (!neonSpentMatch) {
          console.log(`   ⚠️  Neon Spent: Expected £${actualSpent.toFixed(2)}, Got £${(team.football_spent || 0).toFixed(2)}`);
        }
        if (!firebasePlayerCountMatch) {
          console.log(`   ⚠️  Firebase Player Count: Expected ${expectedTotalPlayers} (${actualCount} football + ${realPlayersCount} real), Got ${firebaseData?.players_count || 0}`);
        }
        if (!firebaseSpentMatch) {
          const firebaseSpent = firebaseData?.currency_system === 'dual' 
            ? (firebaseData?.football_spent || 0)
            : (firebaseData?.total_spent || 0);
          console.log(`   ⚠️  Firebase Spent: Expected £${actualSpent.toFixed(2)}, Got £${firebaseSpent.toFixed(2)}`);
        }
        if (!firebasePositionMatch) {
          console.log(`   ⚠️  Firebase Position Counts Mismatch:`);
          console.log(`      Expected:`, positionCounts);
          console.log(`      Got:`, firebaseData?.position_counts || {});
        }

        discrepancies.push({
          team_id: team.id,
          team_name: team.name,
          season_id: team.season_id,
          football_players_count: actualCount,
          real_players_count: realPlayersCount,
          expected_total_count: expectedTotalPlayers,
          actual_spent: actualSpent,
          neon_count: team.football_players_count || 0,
          neon_spent: team.football_spent || 0,
          firebase_count: firebaseData?.players_count || 0,
          firebase_spent: firebaseData?.currency_system === 'dual' 
            ? (firebaseData?.football_spent || 0)
            : (firebaseData?.total_spent || 0),
          position_counts_actual: positionCounts,
          position_counts_firebase: firebaseData?.position_counts || {},
        });
      } else {
        console.log(`\n✅ All data matches!`);
      }

      // Show player details if there are discrepancies
      if (hasDiscrepancy && players && players[0]) {
        console.log(`\n📝 Player Details:`);
        players.forEach(p => {
          console.log(`   - ${p.name} (${p.position}) - £${p.price} [Round: ${p.round_id}]`);
        });
      }
    }

    // Summary
    console.log(`\n\n${'='.repeat(80)}`);
    console.log(`📊 AUDIT SUMMARY`);
    console.log(`${'='.repeat(80)}`);
    console.log(`Total Teams Audited: ${teams.length}`);
    console.log(`Teams with Discrepancies: ${discrepancies.length}`);
    console.log(`Teams Correct: ${teams.length - discrepancies.length}`);

    if (discrepancies.length > 0) {
      console.log(`\n❌ TEAMS WITH ISSUES:`);
      discrepancies.forEach(d => {
        console.log(`\n   ${d.team_name} (${d.team_id}) - ${d.season_id}`);
        console.log(`      Football Players: ${d.football_players_count}`);
        console.log(`      Real Players: ${d.real_players_count}`);
        console.log(`      Expected Total: ${d.expected_total_count}`);
        console.log(`      Actual Spent: £${d.actual_spent.toFixed(2)}`);
        console.log(`      Neon:   ${d.neon_count} football players, £${d.neon_spent.toFixed(2)}`);
        console.log(`      Firebase: ${d.firebase_count} total players, £${d.firebase_spent.toFixed(2)}`);
      });

      // Save discrepancies to file
      const fs = require('fs');
      fs.writeFileSync(
        'team-finance-discrepancies.json',
        JSON.stringify(discrepancies, null, 2)
      );
      console.log(`\n💾 Discrepancies saved to: team-finance-discrepancies.json`);
    }

    console.log(`\n✅ Audit complete!\n`);

  } catch (error) {
    console.error('❌ Error during audit:', error);
    throw error;
  }
}

// Run the audit
auditTeamFinances()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
