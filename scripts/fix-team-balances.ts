/**
 * Fix Team Balances Script
 * 
 * Calculates correct team balances based on actual player allocations
 * and updates both Neon database and Firebase to match.
 * 
 * Formula: 
 * - Correct football_spent = SUM(purchase_price) from team_players
 * - Correct football_budget = 10000 - football_spent
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { neon } from '@neondatabase/serverless';
import * as admin from 'firebase-admin';

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') });

// Initialize Firebase Admin
if (!admin.apps.length) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  
  if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    console.log('Firebase Admin initialized with service account');
  } else if (projectId) {
    admin.initializeApp({
      projectId: projectId,
    });
    console.log(`Firebase Admin initialized with project ID: ${projectId}`);
  } else {
    admin.initializeApp();
    console.log('Firebase Admin initialized with default credentials');
  }
}

const adminDb = admin.firestore();

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

interface TeamBalance {
  team_id: string;
  team_name: string;
  season_id: string;
  firebase_uid: string;
  current_budget: number;
  current_spent: number;
  actual_spent: number;
  player_count: number;
  correct_budget: number;
  needs_fix: boolean;
}

async function fixTeamBalances() {
  console.log('🔍 Calculating correct team balances...\n');

  try {
    // Get all teams with their current budgets
    const teams = await sql`
      SELECT 
        id as team_id,
        name as team_name,
        season_id,
        firebase_uid,
        football_budget as current_budget,
        football_spent as current_spent,
        football_players_count as player_count
      FROM teams
      WHERE season_id IS NOT NULL
      ORDER BY name
    `;

    console.log(`Found ${teams.length} teams\n`);

    const balances: TeamBalance[] = [];

    // Calculate actual spending for each team
    for (const team of teams) {
      // Get all players purchased by this team
      const playerPurchases = await sql`
        SELECT 
          player_id,
          purchase_price,
          round_id
        FROM team_players
        WHERE team_id = ${team.team_id}
        AND season_id = ${team.season_id}
      `;

      const actualSpent = playerPurchases.reduce((sum: number, p: any) => sum + (p.purchase_price || 0), 0);
      const correctBudget = 10000 - actualSpent;
      const needsFix = team.current_budget !== correctBudget || team.current_spent !== actualSpent;

      balances.push({
        team_id: team.team_id,
        team_name: team.team_name,
        season_id: team.season_id,
        firebase_uid: team.firebase_uid,
        current_budget: team.current_budget,
        current_spent: team.current_spent,
        actual_spent: actualSpent,
        player_count: playerPurchases.length,
        correct_budget: correctBudget,
        needs_fix: needsFix,
      });

      // Display team info
      const status = needsFix ? '❌ NEEDS FIX' : '✅ OK';
      console.log(`${status} ${team.team_name}`);
      console.log(`   Players: ${playerPurchases.length}`);
      console.log(`   Current: Budget £${team.current_budget}, Spent £${team.current_spent}`);
      console.log(`   Correct: Budget £${correctBudget}, Spent £${actualSpent}`);
      if (needsFix) {
        console.log(`   Diff: Budget ${correctBudget - team.current_budget}, Spent ${actualSpent - team.current_spent}`);
      }
      console.log('');
    }

    // Count teams needing fixes
    const teamsNeedingFix = balances.filter(b => b.needs_fix);
    
    if (teamsNeedingFix.length === 0) {
      console.log('🎉 All teams have correct balances! No fixes needed.\n');
      return;
    }

    console.log(`\n⚠️  ${teamsNeedingFix.length} team(s) need balance corrections\n`);

    // Apply fixes
    console.log('🔧 Applying fixes...\n');

    for (const balance of teamsNeedingFix) {
      console.log(`Fixing ${balance.team_name}...`);

      // Fix Neon database
      await sql`
        UPDATE teams
        SET 
          football_budget = ${balance.correct_budget},
          football_spent = ${balance.actual_spent},
          football_players_count = ${balance.player_count},
          updated_at = NOW()
        WHERE id = ${balance.team_id}
        AND season_id = ${balance.season_id}
      `;
      console.log(`   ✅ Updated Neon: Budget £${balance.correct_budget}, Spent £${balance.actual_spent}`);

      // Fix Firebase
      if (balance.firebase_uid) {
        const teamSeasonId = `${balance.firebase_uid}_${balance.season_id}`;
        const teamSeasonRef = adminDb.collection('team_seasons').doc(teamSeasonId);
        const teamSeasonSnap = await teamSeasonRef.get();

        if (teamSeasonSnap.exists) {
          const teamSeasonData = teamSeasonSnap.data();
          const currencySystem = teamSeasonData?.currency_system || 'single';
          const isDualCurrency = currencySystem === 'dual';

          const updateData: any = {
            total_spent: balance.actual_spent,
            players_count: balance.player_count,
            updated_at: new Date()
          };

          if (isDualCurrency) {
            updateData.football_budget = balance.correct_budget;
            updateData.football_spent = balance.actual_spent;
          } else {
            updateData.budget = balance.correct_budget;
          }

          await teamSeasonRef.update(updateData);
          console.log(`   ✅ Updated Firebase: Budget £${balance.correct_budget}, Spent £${balance.actual_spent}`);
        } else {
          console.log(`   ⚠️  Firebase team_season not found: ${teamSeasonId}`);
        }
      } else {
        console.log(`   ⚠️  No firebase_uid for team ${balance.team_id}`);
      }

      console.log('');
    }

    // Final verification
    console.log('🔍 Final verification...\n');
    
    const verifyTeams = await sql`
      SELECT 
        name,
        football_budget,
        football_spent,
        football_players_count
      FROM teams
      WHERE season_id IS NOT NULL
      ORDER BY name
    `;

    console.log('Final state:');
    verifyTeams.forEach((team: any) => {
      console.log(`   ${team.name}: Budget £${team.football_budget}, Spent £${team.football_spent}, Players ${team.football_players_count}`);
    });

    console.log('\n🎉 Balance fix complete!');
    console.log(`   Fixed ${teamsNeedingFix.length} team(s)`);
    console.log(`   Total teams: ${teams.length}`);

  } catch (error) {
    console.error('❌ Error fixing balances:', error);
    throw error;
  }
}

// Run the script
fixTeamBalances()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
