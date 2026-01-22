/**
 * Sync Football Budget - Firebase to Neon (Season 16 Only)
 * 
 * This script syncs football_budget from:
 * - Firebase: team_seasons collection (for SSPSLS16 only)
 * - Neon: teams table in auction database (for SSPSLS16 only)
 * 
 * Firebase is considered the source of truth.
 * 
 * IMPORTANT: This will UPDATE the Neon database!
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const admin = require('firebase-admin');

const SEASON_ID = 'SSPSLS16'; // Season 16

async function syncFootballBudgets() {
    console.log('🔄 Football Budget Sync - Firebase → Neon\n');
    console.log('='.repeat(80));
    console.log(`📋 SEASON: ${SEASON_ID} ONLY`);
    console.log('⚠️  WARNING: This will UPDATE Neon database to match Firebase');
    console.log('='.repeat(80));
    console.log('');

    try {
        // Initialize Firebase Admin using environment variables
        if (!admin.apps.length) {
            if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
                admin.initializeApp({
                    credential: admin.credential.cert({
                        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
                        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
                        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
                    }),
                });
                console.log('✅ Firebase initialized\n');
            } else {
                console.error('❌ Error: Firebase credentials not found in .env.local');
                process.exit(1);
            }
        }

        const db = admin.firestore();

        // Get Neon database connection
        const auctionDbUrl = process.env.NEON_AUCTION_DB_URL;
        if (!auctionDbUrl) {
            console.error('❌ Error: NEON_AUCTION_DB_URL not found in .env.local');
            process.exit(1);
        }

        const sql = neon(auctionDbUrl);

        console.log(`📊 Step 1: Fetching team_seasons from Firebase (Season: ${SEASON_ID})...\n`);

        // Fetch team_seasons for Season 16 only
        const teamSeasonsSnapshot = await db.collection('team_seasons')
            .where('season_id', '==', SEASON_ID)
            .get();

        const firebaseTeamSeasons = [];

        teamSeasonsSnapshot.forEach(doc => {
            const data = doc.data();
            // Document ID format: teamId_seasonId
            const docId = doc.id;
            const [teamId, seasonId] = docId.split('_');

            firebaseTeamSeasons.push({
                docId: docId,
                teamId: teamId,
                seasonId: seasonId,
                teamName: data.team_name || 'Unknown',
                footballBudget: parseFloat(data.football_budget || 0),
            });
        });

        console.log(`✅ Found ${firebaseTeamSeasons.length} team_seasons in Firebase for ${SEASON_ID}\n`);

        console.log(`📊 Step 2: Fetching teams from Neon (Season: ${SEASON_ID})...\n`);

        // Fetch teams for Season 16 only from Neon
        const neonTeams = await sql`
      SELECT 
        id,
        name,
        season_id,
        football_budget
      FROM teams
      WHERE season_id = ${SEASON_ID}
    `;

        console.log(`✅ Found ${neonTeams.length} teams in Neon for ${SEASON_ID}\n`);

        // Create a map of Neon teams by team_id
        const neonTeamMap = new Map();
        neonTeams.forEach(team => {
            neonTeamMap.set(team.id, parseFloat(team.football_budget) || 0);
        });

        // Find teams that need updating
        const teamsToUpdate = [];
        const teamsNotInNeon = [];

        firebaseTeamSeasons.forEach(fbTeamSeason => {
            const neonBudget = neonTeamMap.get(fbTeamSeason.teamId);

            if (neonBudget === undefined) {
                teamsNotInNeon.push(fbTeamSeason);
            } else {
                const difference = Math.abs(fbTeamSeason.footballBudget - neonBudget);
                if (difference >= 0.01) {
                    teamsToUpdate.push({
                        teamId: fbTeamSeason.teamId,
                        name: fbTeamSeason.teamName,
                        currentNeon: neonBudget,
                        newFirebase: fbTeamSeason.footballBudget,
                        difference: fbTeamSeason.footballBudget - neonBudget
                    });
                }
            }
        });

        console.log('='.repeat(80));
        console.log('📊 SYNC PLAN');
        console.log('='.repeat(80));
        console.log('');

        if (teamsToUpdate.length === 0 && teamsNotInNeon.length === 0) {
            console.log('✅ ALL BUDGETS ALREADY IN SYNC!');
            console.log(`   No updates needed for ${SEASON_ID}.\n`);
            process.exit(0);
        }

        if (teamsToUpdate.length > 0) {
            console.log(`🔄 TEAMS TO UPDATE: ${teamsToUpdate.length}\n`);
            teamsToUpdate.forEach(team => {
                console.log(`   📌 ${team.name} (${team.teamId})`);
                console.log(`      Current (Neon):  ${team.currentNeon.toFixed(2).padStart(10)}`);
                console.log(`      New (Firebase):  ${team.newFirebase.toFixed(2).padStart(10)}`);
                console.log(`      Change:          ${(team.difference > 0 ? '+' : '')}${team.difference.toFixed(2).padStart(9)}`);
                console.log('');
            });
        }

        if (teamsNotInNeon.length > 0) {
            console.log(`⚠️  TEAMS NOT IN NEON: ${teamsNotInNeon.length}\n`);
            teamsNotInNeon.forEach(team => {
                console.log(`   ⚠️  ${team.teamName} (${team.teamId}) - Budget: ${team.footballBudget.toFixed(2)}`);
            });
            console.log('');
            console.log(`   These teams will be SKIPPED (not in Neon for ${SEASON_ID})\n`);
        }

        if (teamsToUpdate.length === 0) {
            console.log(`✅ No teams need updating in Neon for ${SEASON_ID}\n`);
            process.exit(0);
        }

        console.log('='.repeat(80));
        console.log('🚀 EXECUTING SYNC');
        console.log('='.repeat(80));
        console.log('');

        let successCount = 0;
        let errorCount = 0;

        for (const team of teamsToUpdate) {
            try {
                await sql`
          UPDATE teams
          SET 
            football_budget = ${team.newFirebase},
            updated_at = NOW()
          WHERE id = ${team.teamId}
          AND season_id = ${SEASON_ID}
        `;

                console.log(`✅ Updated ${team.name}: ${team.currentNeon.toFixed(2)} → ${team.newFirebase.toFixed(2)}`);
                successCount++;
            } catch (error) {
                console.error(`❌ Failed to update ${team.name}:`, error.message);
                errorCount++;
            }
        }

        console.log('');
        console.log('='.repeat(80));
        console.log('📊 SYNC COMPLETE');
        console.log('='.repeat(80));
        console.log(`   ✅ Successfully updated:  ${successCount}`);
        console.log(`   ❌ Failed to update:      ${errorCount}`);
        console.log(`   ⚠️  Skipped (not in Neon): ${teamsNotInNeon.length}`);
        console.log('');

        if (errorCount > 0) {
            console.log('⚠️  Some updates failed. Please review the errors above.');
        } else if (successCount > 0) {
            console.log(`✅ All budgets successfully synced from Firebase to Neon for ${SEASON_ID}!`);
            console.log('   Run check-ecoin-balances.js to verify.');
        }

        console.log('');
        console.log('='.repeat(80));

        process.exit(errorCount > 0 ? 1 : 0);

    } catch (error) {
        console.error('\n❌ Error during sync:');
        console.error(error);
        console.error('\nDetails:', error.message);
        process.exit(1);
    }
}

// Run the sync
syncFootballBudgets().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
