/**
 * Complete Team Finance Fix Script
 * 
 * Fixes all team finance issues:
 * 1. Neon football_players_count
 * 2. Neon football_spent
 * 3. Neon football_budget
 * 4. Firebase football_spent/total_spent
 * 5. Firebase football_budget/budget
 * 6. Firebase position_counts
 * 7. Firebase players_count (football + real players)
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
      console.log(`✅ Firebase Admin initialized\n`);
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

async function fixTeamFinances(dryRun = true) {
  console.log('🔧 Starting Complete Team Finance Fix...');
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (no changes)' : '⚡ LIVE (will update databases)'}\n`);

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

    console.log(`📊 Processing ${teams.length} teams in Season 16\n`);

    let fixedCount = 0;
    const fixes = [];

    for (const team of teams) {
      console.log(`${'='.repeat(80)}`);
      console.log(`🏆 ${team.name} (${team.id})`);
      console.log(`${'='.repeat(80)}`);

      // 1. Get actual football players data
      const actualData = await sql`
        SELECT 
          COUNT(*) as player_count,
          COALESCE(SUM(acquisition_value), 0) as total_spent,
          json_agg(
            json_build_object(
              'name', name,
              'position', position,
              'price', acquisition_value
            )
          ) as players
        FROM footballplayers
        WHERE team_id = ${team.id}
        AND season_id = ${team.season_id}
        AND is_sold = true
      `;

      const footballPlayersCount = parseInt(actualData[0].player_count) || 0;
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

      // 2. Calculate correct budget
      const initialBudget = 10000;
      const correctBudget = initialBudget - actualSpent;

      console.log(`\n📋 CALCULATED VALUES:`);
      console.log(`   Football Players: ${footballPlayersCount}`);
      console.log(`   Total Spent: £${actualSpent.toFixed(2)}`);
      console.log(`   Correct Budget: £${correctBudget.toFixed(2)}`);
      console.log(`   Position Counts:`, positionCounts);

      // 3. Get real players count from tournament database player_seasons table
      const realPlayersData = await tournamentSql`
        SELECT COUNT(*) as real_player_count
        FROM player_seasons
        WHERE team_id = ${team.id}
        AND season_id = ${team.season_id}
      `;

      const realPlayersCount = parseInt(realPlayersData[0].real_player_count) || 0;
      const expectedTotalPlayers = footballPlayersCount + realPlayersCount;

      console.log(`   Real Players: ${realPlayersCount}`);
      console.log(`   Expected Total: ${expectedTotalPlayers}`);

      // 4. Get Firebase team_seasons data
      const teamSeasonId = `${team.id}_${team.season_id}`;
      const teamSeasonDoc = await db.collection('team_seasons').doc(teamSeasonId).get();
      
      let firebaseData = null;
      if (teamSeasonDoc.exists) {
        firebaseData = teamSeasonDoc.data();
      }

      // 5. Check current values
      console.log(`\n📊 CURRENT VALUES:`);
      console.log(`   Neon:`);
      console.log(`      football_players_count: ${team.football_players_count || 0}`);
      console.log(`      football_spent: £${(team.football_spent || 0).toFixed(2)}`);
      console.log(`      football_budget: £${(team.football_budget || 0).toFixed(2)}`);

      if (firebaseData) {
        const isDual = firebaseData.currency_system === 'dual';
        const fbSpent = isDual ? (firebaseData.football_spent || 0) : (firebaseData.total_spent || 0);
        const fbBudget = isDual ? (firebaseData.football_budget || 0) : (firebaseData.budget || 0);
        
        console.log(`   Firebase:`);
        console.log(`      players_count: ${firebaseData.players_count || 0}`);
        console.log(`      spent: £${fbSpent.toFixed(2)}`);
        console.log(`      budget: £${fbBudget.toFixed(2)}`);
        console.log(`      position_counts:`, firebaseData.position_counts || {});
      }

      // 6. Determine if updates are needed
      const neonNeedsUpdate = 
        footballPlayersCount !== (team.football_players_count || 0) ||
        Math.abs(actualSpent - (team.football_spent || 0)) > 0.01 ||
        Math.abs(correctBudget - (team.football_budget || 0)) > 0.01;

      let firebaseNeedsUpdate = false;
      if (firebaseData) {
        const isDual = firebaseData.currency_system === 'dual';
        const fbSpent = isDual ? (firebaseData.football_spent || 0) : (firebaseData.total_spent || 0);
        const fbBudget = isDual ? (firebaseData.football_budget || 0) : (firebaseData.budget || 0);
        const fbPositions = firebaseData.position_counts || {};
        const fbPlayersCount = firebaseData.players_count || 0;
        
        // Compare position counts properly (order-independent)
        const positionsMatch = Object.keys(positionCounts).length === Object.keys(fbPositions).length &&
          Object.keys(positionCounts).every(key => positionCounts[key] === fbPositions[key]);
        
        firebaseNeedsUpdate = 
          Math.abs(actualSpent - fbSpent) > 0.01 ||
          Math.abs(correctBudget - fbBudget) > 0.01 ||
          !positionsMatch ||
          expectedTotalPlayers !== fbPlayersCount;
      }

      // 7. Apply fixes
      if (neonNeedsUpdate || firebaseNeedsUpdate) {
        console.log(`\n🔧 UPDATES NEEDED:`);
        
        if (neonNeedsUpdate) {
          console.log(`   ✓ Neon teams table:`);
          if (footballPlayersCount !== (team.football_players_count || 0)) {
            console.log(`      - football_players_count: ${team.football_players_count || 0} → ${footballPlayersCount}`);
          }
          if (Math.abs(actualSpent - (team.football_spent || 0)) > 0.01) {
            console.log(`      - football_spent: £${(team.football_spent || 0).toFixed(2)} → £${actualSpent.toFixed(2)}`);
          }
          if (Math.abs(correctBudget - (team.football_budget || 0)) > 0.01) {
            console.log(`      - football_budget: £${(team.football_budget || 0).toFixed(2)} → £${correctBudget.toFixed(2)}`);
          }
        }
        
        if (firebaseNeedsUpdate) {
          console.log(`   ✓ Firebase team_seasons:`);
          if (firebaseData) {
            const isDual = firebaseData.currency_system === 'dual';
            const fbSpent = isDual ? (firebaseData.football_spent || 0) : (firebaseData.total_spent || 0);
            const fbBudget = isDual ? (firebaseData.football_budget || 0) : (firebaseData.budget || 0);
            
            if (Math.abs(actualSpent - fbSpent) > 0.01) {
              console.log(`      - spent: £${fbSpent.toFixed(2)} → £${actualSpent.toFixed(2)}`);
            }
            if (Math.abs(correctBudget - fbBudget) > 0.01) {
              console.log(`      - budget: £${fbBudget.toFixed(2)} → £${correctBudget.toFixed(2)}`);
            }
            if (expectedTotalPlayers !== (firebaseData.players_count || 0)) {
              console.log(`      - players_count: ${firebaseData.players_count || 0} → ${expectedTotalPlayers}`);
            }
            const fbPositions = firebaseData.position_counts || {};
            const positionsMatch = Object.keys(positionCounts).length === Object.keys(fbPositions).length &&
              Object.keys(positionCounts).every(key => positionCounts[key] === fbPositions[key]);
            if (!positionsMatch) {
              console.log(`      - position_counts: updated`);
            }
          }
        }

        if (!dryRun) {
          // Update Neon
          if (neonNeedsUpdate) {
            await sql`
              UPDATE teams
              SET 
                football_players_count = ${footballPlayersCount},
                football_spent = ${actualSpent},
                football_budget = ${correctBudget},
                updated_at = NOW()
              WHERE id = ${team.id}
              AND season_id = ${team.season_id}
            `;
            console.log(`   ✅ Updated Neon`);
          }

          // Update Firebase
          if (firebaseNeedsUpdate && firebaseData) {
            const isDual = firebaseData.currency_system === 'dual';
            const updateData = {
              players_count: expectedTotalPlayers,
              position_counts: positionCounts,
              updated_at: new Date()
            };

            if (isDual) {
              updateData.football_spent = actualSpent;
              updateData.football_budget = correctBudget;
              updateData.total_spent = actualSpent;
            } else {
              updateData.total_spent = actualSpent;
              updateData.budget = correctBudget;
            }

            await db.collection('team_seasons').doc(teamSeasonId).update(updateData);
            console.log(`   ✅ Updated Firebase`);
          }
        }

        fixes.push({
          team_id: team.id,
          team_name: team.name,
          football_players: footballPlayersCount,
          real_players: realPlayersCount,
          total_players: expectedTotalPlayers,
          actual_spent: actualSpent,
          correct_budget: correctBudget,
          position_counts: positionCounts,
          neon_updated: neonNeedsUpdate,
          firebase_updated: firebaseNeedsUpdate
        });

        fixedCount++;
      } else {
        console.log(`\n✅ No updates needed - data is correct`);
      }
    }

    // Summary
    console.log(`\n\n${'='.repeat(80)}`);
    console.log(`📊 FIX SUMMARY`);
    console.log(`${'='.repeat(80)}`);
    console.log(`Teams Processed: ${teams.length}`);
    console.log(`Teams Fixed: ${fixedCount}`);
    console.log(`Teams Already Correct: ${teams.length - fixedCount}`);

    if (dryRun && fixedCount > 0) {
      console.log(`\n⚠️  This was a DRY RUN - no changes were made`);
      console.log(`   Run with --apply flag to apply fixes:`);
      console.log(`   node fix-team-finances-complete.js --apply`);
    } else if (!dryRun && fixedCount > 0) {
      console.log(`\n✅ All fixes applied successfully!`);
    }

    if (fixes.length > 0) {
      const fs = require('fs');
      fs.writeFileSync(
        'team-finance-fixes-applied.json',
        JSON.stringify(fixes, null, 2)
      );
      console.log(`\n💾 Fix details saved to: team-finance-fixes-applied.json`);
    }

    console.log(`\n✅ Process complete!\n`);

  } catch (error) {
    console.error('❌ Error during fix:', error);
    throw error;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = !args.includes('--apply');

if (dryRun) {
  console.log('💡 Running in DRY RUN mode. Use --apply flag to make actual changes.\n');
}

fixTeamFinances(dryRun)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
