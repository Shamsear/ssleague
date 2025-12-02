/**
 * Fix Team Finances and Player Counts
 * 
 * This script recalculates and updates:
 * 1. Team spending (football_spent)
 * 2. Team budget (football_budget)
 * 3. Player counts (football_players_count)
 * 4. Position counts
 * 
 * Based on actual data from footballplayers table
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

async function fixTeamFinances(dryRun = true) {
  console.log('🔧 Starting Team Finance Fix...');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will update database)'}\n`);

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
        initial_football_budget,
        firebase_uid
      FROM teams
      ORDER BY season_id, name
    `;

    console.log(`📊 Found ${teams.length} teams to process\n`);

    let fixedCount = 0;
    const fixes = [];

    for (const team of teams) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🏆 Processing: ${team.name} (${team.id}) - ${team.season_id}`);
      console.log(`${'='.repeat(80)}`);

      // 1. Calculate actual spending from footballplayers table
      const actualData = await sql`
        SELECT 
          COUNT(*) as player_count,
          COALESCE(SUM(acquisition_value), 0) as total_spent,
          json_agg(
            json_build_object(
              'id', id,
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

      const actual = actualData[0];
      const actualCount = parseInt(actual.player_count) || 0;
      const actualSpent = parseFloat(actual.total_spent) || 0;
      const players = actual.players || [];

      // Calculate position counts
      const positionCounts = {
        GK: 0,
        DEF: 0,
        MID: 0,
        FWD: 0
      };
      
      if (players && players[0]) {
        players.forEach(p => {
          if (p.position && positionCounts.hasOwnProperty(p.position)) {
            positionCounts[p.position]++;
          }
        });
      }

      console.log(`\n📋 Calculated from footballplayers:`);
      console.log(`   Players: ${actualCount}`);
      console.log(`   Total Spent: £${actualSpent.toFixed(2)}`);
      console.log(`   Position Counts:`, positionCounts);

      // 2. Get initial budget (or use default)
      const initialBudget = team.initial_football_budget || 1000;
      const correctBudget = initialBudget - actualSpent;

      console.log(`\n💰 Budget Calculation:`);
      console.log(`   Initial Budget: £${initialBudget.toFixed(2)}`);
      console.log(`   Spent: £${actualSpent.toFixed(2)}`);
      console.log(`   Remaining Budget: £${correctBudget.toFixed(2)}`);

      // 3. Check if updates are needed
      const neonNeedsUpdate = 
        actualCount !== (team.football_players_count || 0) ||
        Math.abs(actualSpent - (team.football_spent || 0)) > 0.01 ||
        Math.abs(correctBudget - (team.football_budget || 0)) > 0.01;

      // 4. Get real players count from tournament database
      const realPlayersResult = await tournamentSql`
        SELECT COUNT(*) as count
        FROM player_seasons
        WHERE team_id = ${team.id}
        AND season_id = ${team.season_id}
      `;
      
      const realPlayersCount = parseInt(realPlayersResult[0]?.count || 0);
      const expectedTotalPlayers = actualCount + realPlayersCount;

      console.log(`\n👥 Real Players:`);
      console.log(`   Real Players Count: ${realPlayersCount}`);
      console.log(`   Expected Total (Football + Real): ${expectedTotalPlayers}`);

      // 5. Check Firebase
      const teamSeasonId = `${team.id}_${team.season_id}`;
      const teamSeasonDoc = await db.collection('team_seasons').doc(teamSeasonId).get();
      
      let firebaseNeedsUpdate = false;
      let firebaseData = null;
      
      if (teamSeasonDoc.exists) {
        firebaseData = teamSeasonDoc.data();
        const isDualCurrency = firebaseData.currency_system === 'dual';
        
        const fbPlayerCount = firebaseData.players_count || 0;
        const fbSpent = isDualCurrency ? (firebaseData.football_spent || 0) : (firebaseData.total_spent || 0);
        const fbBudget = isDualCurrency ? (firebaseData.football_budget || 0) : (firebaseData.budget || 0);
        const fbPositionCounts = firebaseData.position_counts || {};
        
        firebaseNeedsUpdate = 
          expectedTotalPlayers !== fbPlayerCount ||
          Math.abs(actualSpent - fbSpent) > 0.01 ||
          Math.abs(correctBudget - fbBudget) > 0.01 ||
          JSON.stringify(positionCounts) !== JSON.stringify(fbPositionCounts);

        console.log(`\n🔥 Firebase Current State:`);
        console.log(`   Players Count: ${fbPlayerCount} (should be ${expectedTotalPlayers})`);
        console.log(`   Spent: £${fbSpent.toFixed(2)}`);
        console.log(`   Budget: £${fbBudget.toFixed(2)}`);
        console.log(`   Position Counts:`, fbPositionCounts);
      }

      // 5. Apply fixes if needed
      if (neonNeedsUpdate || firebaseNeedsUpdate) {
        console.log(`\n🔧 UPDATES NEEDED:`);
        
        if (neonNeedsUpdate) {
          console.log(`   ✓ Neon teams table`);
          console.log(`      - football_players_count: ${team.football_players_count || 0} → ${actualCount}`);
          console.log(`      - football_spent: £${(team.football_spent || 0).toFixed(2)} → £${actualSpent.toFixed(2)}`);
          console.log(`      - football_budget: £${(team.football_budget || 0).toFixed(2)} → £${correctBudget.toFixed(2)}`);
        }
        
        if (firebaseNeedsUpdate) {
          console.log(`   ✓ Firebase team_seasons`);
        }

        if (!dryRun) {
          // Update Neon
          if (neonNeedsUpdate) {
            await sql`
              UPDATE teams
              SET 
                football_players_count = ${actualCount},
                football_spent = ${actualSpent},
                football_budget = ${correctBudget},
                updated_at = NOW()
              WHERE id = ${team.id}
              AND season_id = ${team.season_id}
            `;
            console.log(`   ✅ Updated Neon teams table`);
          }

          // Update Firebase
          if (firebaseNeedsUpdate && firebaseData) {
            const isDualCurrency = firebaseData.currency_system === 'dual';
            const updateData = {
              players_count: expectedTotalPlayers, // Football + Real players
              position_counts: positionCounts,
              updated_at: new Date()
            };

            if (isDualCurrency) {
              updateData.football_spent = actualSpent;
              updateData.football_budget = correctBudget;
              updateData.total_spent = actualSpent; // Keep in sync
            } else {
              updateData.total_spent = actualSpent;
              updateData.budget = correctBudget;
            }

            await db.collection('team_seasons').doc(teamSeasonId).update(updateData);
            console.log(`   ✅ Updated Firebase team_seasons`);
          }
        }

        fixes.push({
          team_id: team.id,
          team_name: team.name,
          season_id: team.season_id,
          football_players_count: actualCount,
          real_players_count: realPlayersCount,
          expected_total_count: expectedTotalPlayers,
          actual_spent: actualSpent,
          correct_budget: correctBudget,
          position_counts: positionCounts,
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
    console.log(`Total Teams Processed: ${teams.length}`);
    console.log(`Teams Fixed: ${fixedCount}`);
    console.log(`Teams Already Correct: ${teams.length - fixedCount}`);

    if (dryRun && fixedCount > 0) {
      console.log(`\n⚠️  This was a DRY RUN - no changes were made`);
      console.log(`   Run with dryRun=false to apply fixes`);
    } else if (!dryRun && fixedCount > 0) {
      console.log(`\n✅ All fixes applied successfully!`);
    }

    // Save fix details
    if (fixes.length > 0) {
      const fs = require('fs');
      fs.writeFileSync(
        'team-finance-fixes.json',
        JSON.stringify(fixes, null, 2)
      );
      console.log(`\n💾 Fix details saved to: team-finance-fixes.json`);
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

// Run the fix
fixTeamFinances(dryRun)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
