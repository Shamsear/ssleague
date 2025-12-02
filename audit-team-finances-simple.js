/**
 * Simplified Team Finance Audit
 * 
 * Focuses on the actual issues:
 * 1. Neon spending discrepancies
 * 2. Position count mismatches
 * 3. Neon player count errors
 */

const { neon } = require('@neondatabase/serverless');
const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin
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
      console.log('✅ Firebase Admin initialized\n');
    } else if (projectId) {
      admin.initializeApp({
        projectId: projectId,
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || `https://${projectId}-default-rtdb.firebaseio.com`,
      });
      console.log(`✅ Firebase Admin initialized with project ID\n`);
    } else {
      admin.initializeApp();
      console.log('✅ Firebase Admin initialized\n');
    }
  } catch (error) {
    console.error('❌ Firebase admin initialization error:', error);
    throw new Error('Failed to initialize Firebase Admin SDK');
  }
}

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);
const tournamentSql = neon(process.env.NEON_TOURNAMENT_DB_URL);
const db = admin.firestore();

async function auditTeamFinances() {
  console.log('🔍 Starting Simplified Team Finance Audit...\n');

  try {
    const teams = await sql`
      SELECT 
        id,
        name,
        season_id,
        football_budget,
        football_spent,
        football_players_count
      FROM teams
      WHERE season_id = 'SSPSLS16'
      ORDER BY name
    `;

    console.log(`📊 Auditing ${teams.length} teams in Season 16\n`);

    const issues = [];

    for (const team of teams) {
      console.log(`${'='.repeat(80)}`);
      console.log(`🏆 ${team.name} (${team.id})`);
      console.log(`${'='.repeat(80)}`);

      // 1. Calculate actual from footballplayers table
      const actualData = await sql`
        SELECT 
          COUNT(*) as player_count,
          COALESCE(SUM(acquisition_value), 0) as total_spent,
          json_agg(
            json_build_object(
              'name', name,
              'position', position,
              'price', acquisition_value
            ) ORDER BY acquisition_value DESC
          ) as players
        FROM footballplayers
        WHERE team_id = ${team.id}
        AND season_id = ${team.season_id}
        AND is_sold = true
      `;

      const actualCount = parseInt(actualData[0].player_count) || 0;
      const actualSpent = parseFloat(actualData[0].total_spent) || 0;
      const players = actualData[0].players || [];

      // Calculate position counts
      const positionCounts = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
      if (players && players[0]) {
        players.forEach(p => {
          if (p.position) {
            positionCounts[p.position] = (positionCounts[p.position] || 0) + 1;
          }
        });
      }

      console.log(`\n📋 ACTUAL (from footballplayers):`);
      console.log(`   Count: ${actualCount} players`);
      console.log(`   Spent: £${actualSpent.toFixed(2)}`);
      console.log(`   Positions:`, positionCounts);

      // 2. Get real players count from tournament database player_seasons table
      const realPlayersData = await tournamentSql`
        SELECT COUNT(*) as real_player_count
        FROM player_seasons
        WHERE team_id = ${team.id}
        AND season_id = ${team.season_id}
      `;
      
      const realPlayersCount = parseInt(realPlayersData[0].real_player_count) || 0;
      const expectedTotalPlayers = actualCount + realPlayersCount;

      // 3. Check Neon
      const neonCount = team.football_players_count || 0;
      const neonSpent = team.football_spent || 0;
      const neonBudget = team.football_budget || 0;
      const initialBudget = 10000; // Standard initial budget
      const expectedBudget = initialBudget - actualSpent;

      console.log(`\n📊 NEON (teams table):`);
      console.log(`   Football Players: ${neonCount}`);
      console.log(`   Real Players: ${realPlayersCount}`);
      console.log(`   Expected Total: ${expectedTotalPlayers}`);
      console.log(`   Spent: £${neonSpent.toFixed(2)}`);
      console.log(`   Budget: £${neonBudget.toFixed(2)}`);

      // 4. Check Firebase
      const teamSeasonId = `${team.id}_${team.season_id}`;
      const teamSeasonDoc = await db.collection('team_seasons').doc(teamSeasonId).get();
      
      let firebaseData = null;
      if (teamSeasonDoc.exists) {
        firebaseData = teamSeasonDoc.data();
        const isDual = firebaseData.currency_system === 'dual';
        const fbSpent = isDual ? (firebaseData.football_spent || 0) : (firebaseData.total_spent || 0);
        const fbBudget = isDual ? (firebaseData.football_budget || 0) : (firebaseData.budget || 0);
        const fbPositions = firebaseData.position_counts || {};

        console.log(`\n🔥 FIREBASE (team_seasons):`);
        console.log(`   Total Players: ${firebaseData.players_count || 0}`);
        console.log(`   Spent: £${fbSpent.toFixed(2)}`);
        console.log(`   Budget: £${fbBudget.toFixed(2)}`);
        console.log(`   Positions:`, fbPositions);
      }

      // Compare position counts properly (order-independent)
      let positionsMatch = true;
      if (firebaseData) {
        const fbPositions = firebaseData.position_counts || {};
        positionsMatch = Object.keys(positionCounts).length === Object.keys(fbPositions).length &&
          Object.keys(positionCounts).every(key => positionCounts[key] === fbPositions[key]);
      }
      
      const hasIssues = {
        neonCount: actualCount !== neonCount,
        neonSpent: Math.abs(actualSpent - neonSpent) > 0.01,
        neonBudget: Math.abs(expectedBudget - neonBudget) > 0.01,
        firebaseSpent: firebaseData && Math.abs(actualSpent - (firebaseData.currency_system === 'dual' ? firebaseData.football_spent : firebaseData.total_spent)) > 0.01,
        firebaseBudget: firebaseData && Math.abs(expectedBudget - (firebaseData.currency_system === 'dual' ? firebaseData.football_budget : firebaseData.budget)) > 0.01,
        firebasePlayerCount: firebaseData && expectedTotalPlayers !== (firebaseData.players_count || 0),
        positions: firebaseData && !positionsMatch
      };

      const hasAnyIssue = Object.values(hasIssues).some(v => v);

      if (hasAnyIssue) {
        console.log(`\n❌ ISSUES FOUND:`);
        
        if (hasIssues.neonCount) {
          console.log(`   ⚠️  Neon Count: ${neonCount} → should be ${actualCount} (diff: ${actualCount - neonCount})`);
        }
        if (hasIssues.neonSpent) {
          console.log(`   ⚠️  Neon Spent: £${neonSpent.toFixed(2)} → should be £${actualSpent.toFixed(2)} (diff: £${(actualSpent - neonSpent).toFixed(2)})`);
        }
        if (hasIssues.neonBudget) {
          console.log(`   ⚠️  Neon Budget: £${neonBudget.toFixed(2)} → should be £${expectedBudget.toFixed(2)} (diff: £${(expectedBudget - neonBudget).toFixed(2)})`);
        }
        if (hasIssues.firebaseSpent) {
          const fbSpent = firebaseData.currency_system === 'dual' ? firebaseData.football_spent : firebaseData.total_spent;
          console.log(`   ⚠️  Firebase Spent: £${fbSpent.toFixed(2)} → should be £${actualSpent.toFixed(2)} (diff: £${(actualSpent - fbSpent).toFixed(2)})`);
        }
        if (hasIssues.firebaseBudget) {
          const fbBudget = firebaseData.currency_system === 'dual' ? firebaseData.football_budget : firebaseData.budget;
          console.log(`   ⚠️  Firebase Budget: £${fbBudget.toFixed(2)} → should be £${expectedBudget.toFixed(2)} (diff: £${(expectedBudget - fbBudget).toFixed(2)})`);
        }
        if (hasIssues.firebasePlayerCount) {
          console.log(`   ⚠️  Firebase Player Count: ${firebaseData.players_count || 0} → should be ${expectedTotalPlayers} (diff: ${expectedTotalPlayers - (firebaseData.players_count || 0)})`);
        }
        if (hasIssues.positions) {
          console.log(`   ⚠️  Position Counts Mismatch`);
        }

        issues.push({
          team_id: team.id,
          team_name: team.name,
          issues: hasIssues,
          actual_football_count: actualCount,
          actual_real_count: realPlayersCount,
          expected_total_count: expectedTotalPlayers,
          actual_spent: actualSpent,
          expected_budget: expectedBudget,
          neon_count: neonCount,
          neon_spent: neonSpent,
          neon_budget: neonBudget,
          firebase_player_count: firebaseData ? firebaseData.players_count : 0,
          position_counts: positionCounts
        });
      } else {
        console.log(`\n✅ All data correct!`);
      }
    }

    // Summary
    console.log(`\n\n${'='.repeat(80)}`);
    console.log(`📊 AUDIT SUMMARY`);
    console.log(`${'='.repeat(80)}`);
    console.log(`Teams Audited: ${teams.length}`);
    console.log(`Teams with Issues: ${issues.length}`);
    console.log(`Teams Correct: ${teams.length - issues.length}`);

    if (issues.length > 0) {
      console.log(`\n❌ ISSUES BY TYPE:`);
      const countIssue = issues.filter(i => i.issues.neonCount).length;
      const spentIssue = issues.filter(i => i.issues.neonSpent || i.issues.firebaseSpent).length;
      const budgetIssue = issues.filter(i => i.issues.neonBudget || i.issues.firebaseBudget).length;
      const playerCountIssue = issues.filter(i => i.issues.firebasePlayerCount).length;
      const positionIssue = issues.filter(i => i.issues.positions).length;

      console.log(`   Neon Football Player Count Issues: ${countIssue} teams`);
      console.log(`   Spending Issues: ${spentIssue} teams`);
      console.log(`   Budget Issues: ${budgetIssue} teams`);
      console.log(`   Firebase Total Player Count Issues: ${playerCountIssue} teams`);
      console.log(`   Position Count Issues: ${positionIssue} teams`);

      // Calculate total money discrepancy
      const totalDiscrepancy = issues.reduce((sum, i) => {
        return sum + (i.actual_spent - i.neon_spent);
      }, 0);
      console.log(`\n💰 Total Underreported Spending: £${totalDiscrepancy.toFixed(2)}`);

      const fs = require('fs');
      fs.writeFileSync(
        'team-finance-issues.json',
        JSON.stringify(issues, null, 2)
      );
      console.log(`\n💾 Issues saved to: team-finance-issues.json`);
    }

    console.log(`\n✅ Audit complete!\n`);

  } catch (error) {
    console.error('❌ Error during audit:', error);
    throw error;
  }
}

auditTeamFinances()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
