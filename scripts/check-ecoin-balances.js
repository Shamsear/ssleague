/**
 * Football Budget Checker - Firebase vs Neon (Season 16 Only)
 * 
 * This script compares football_budget between:
 * - Firebase: team_seasons collection (for SSPSLS16 only)
 * - Neon: teams table in auction database (for SSPSLS16 only)
 * 
 * PREVIEW ONLY - No changes will be made to any database
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const admin = require('firebase-admin');

const SEASON_ID = 'SSPSLS16'; // Season 16

async function checkFootballBudgets() {
    console.log('🔍 Football Budget Checker - Firebase vs Neon\n');
    console.log('='.repeat(80));
    console.log(`📋 SEASON: ${SEASON_ID} ONLY`);
    console.log('📋 PREVIEW MODE - No changes will be made');
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
        football_budget,
        football_spent,
        updated_at
      FROM teams
      WHERE season_id = ${SEASON_ID}
      ORDER BY name
    `;

        console.log(`✅ Found ${neonTeams.length} teams in Neon for ${SEASON_ID}\n`);

        console.log('='.repeat(80));
        console.log('📊 COMPARISON RESULTS');
        console.log('='.repeat(80));
        console.log('');

        // Create a map of Neon teams by team_id
        const neonTeamMap = new Map();
        neonTeams.forEach(team => {
            neonTeamMap.set(team.id, team);
        });

        // Compare teams
        const matches = [];
        const mismatches = [];
        const firebaseOnly = [];
        const neonOnly = [];

        // Check Firebase team_seasons against Neon teams
        firebaseTeamSeasons.forEach(fbTeamSeason => {
            const neonTeam = neonTeamMap.get(fbTeamSeason.teamId);

            if (!neonTeam) {
                firebaseOnly.push(fbTeamSeason);
            } else {
                const fbBudget = fbTeamSeason.footballBudget;
                const neonBudget = parseFloat(neonTeam.football_budget) || 0;

                // Consider them matching if difference is less than 0.01 (rounding)
                const difference = Math.abs(fbBudget - neonBudget);

                if (difference < 0.01) {
                    matches.push({
                        teamId: fbTeamSeason.teamId,
                        teamName: fbTeamSeason.teamName,
                        budget: fbBudget
                    });
                } else {
                    mismatches.push({
                        teamId: fbTeamSeason.teamId,
                        teamName: fbTeamSeason.teamName,
                        docId: fbTeamSeason.docId,
                        firebase: fbBudget,
                        neon: neonBudget,
                        difference: fbBudget - neonBudget
                    });
                }

                // Remove from map to track Neon-only teams
                neonTeamMap.delete(fbTeamSeason.teamId);
            }
        });

        // Remaining teams in map are Neon-only
        neonTeamMap.forEach(team => {
            neonOnly.push({
                teamId: team.id,
                teamName: team.name,
                budget: parseFloat(team.football_budget) || 0
            });
        });

        // Display results
        console.log('✅ MATCHING BUDGETS');
        console.log('-'.repeat(80));
        if (matches.length === 0) {
            console.log('   No teams with matching budgets found');
        } else {
            console.log(`   Found ${matches.length} teams with matching budgets:\n`);
            matches.slice(0, 10).forEach(team => {
                console.log(`   ${team.teamName.padEnd(35)} Budget: ${team.budget.toFixed(2).padStart(10)}`);
            });
            if (matches.length > 10) {
                console.log(`   ... and ${matches.length - 10} more`);
            }
        }
        console.log('');

        console.log('⚠️  MISMATCHED BUDGETS');
        console.log('-'.repeat(80));
        if (mismatches.length === 0) {
            console.log('   ✅ No mismatches found - all budgets match!');
        } else {
            console.log(`   Found ${mismatches.length} teams with mismatched budgets:\n`);
            mismatches.forEach(team => {
                console.log(`   📌 ${team.teamName} (${team.teamId})`);
                console.log(`      Doc ID:     ${team.docId}`);
                console.log(`      Firebase  - Budget: ${team.firebase.toFixed(2).padStart(10)}`);
                console.log(`      Neon      - Budget: ${team.neon.toFixed(2).padStart(10)}`);
                console.log(`      Difference-         ${(team.difference > 0 ? '+' : '')}${team.difference.toFixed(2).padStart(9)}`);
                console.log('');
            });
        }

        console.log(`📋 FIREBASE ONLY (Not in Neon for ${SEASON_ID})`);
        console.log('-'.repeat(80));
        if (firebaseOnly.length === 0) {
            console.log('   ✅ All Firebase team_seasons exist in Neon');
        } else {
            console.log(`   Found ${firebaseOnly.length} team_seasons only in Firebase:\n`);
            firebaseOnly.forEach(team => {
                console.log(`   ${team.teamName.padEnd(35)} (${team.teamId}) - Budget: ${team.footballBudget.toFixed(2)}`);
            });
        }
        console.log('');

        console.log(`📋 NEON ONLY (Not in Firebase team_seasons for ${SEASON_ID})`);
        console.log('-'.repeat(80));
        if (neonOnly.length === 0) {
            console.log('   ✅ All Neon teams exist in Firebase');
        } else {
            console.log(`   Found ${neonOnly.length} teams only in Neon:\n`);
            neonOnly.forEach(team => {
                console.log(`   ${team.teamName.padEnd(35)} (${team.teamId}) - Budget: ${team.budget.toFixed(2)}`);
            });
        }
        console.log('');

        // Summary
        console.log('='.repeat(80));
        console.log(`📊 SUMMARY (${SEASON_ID})`);
        console.log('='.repeat(80));
        console.log(`   Total Firebase team_seasons:  ${firebaseTeamSeasons.length}`);
        console.log(`   Total Neon Teams:             ${neonTeams.length}`);
        console.log(`   ✅ Matching Budgets:          ${matches.length}`);
        console.log(`   ⚠️  Mismatched Budgets:       ${mismatches.length}`);
        console.log(`   📋 Firebase Only:             ${firebaseOnly.length}`);
        console.log(`   📋 Neon Only:                 ${neonOnly.length}`);
        console.log('');

        // Calculate total budgets
        const totalFirebase = firebaseTeamSeasons.reduce((sum, t) => sum + t.footballBudget, 0);
        const totalNeon = neonTeams.reduce((sum, t) => sum + (parseFloat(t.football_budget) || 0), 0);

        console.log('💰 TOTAL BUDGETS');
        console.log('-'.repeat(80));
        console.log(`   Firebase Total:           ${totalFirebase.toFixed(2).padStart(12)}`);
        console.log(`   Neon Total:               ${totalNeon.toFixed(2).padStart(12)}`);
        console.log(`   Difference:               ${(totalFirebase - totalNeon > 0 ? '+' : '')}${(totalFirebase - totalNeon).toFixed(2).padStart(11)}`);
        console.log('');

        if (mismatches.length > 0) {
            console.log('⚠️  ACTION REQUIRED:');
            console.log('   Mismatches detected. Review the differences above.');
            console.log('   Run sync script to update Neon to match Firebase.');
        } else if (firebaseOnly.length > 0 || neonOnly.length > 0) {
            console.log('⚠️  ACTION REQUIRED:');
            console.log('   Some teams exist in only one database.');
            console.log('   Review and sync as needed.');
        } else {
            console.log('✅ ALL BUDGETS MATCH!');
            console.log(`   Firebase and Neon databases are perfectly in sync for ${SEASON_ID}.`);
        }

        console.log('');
        console.log('='.repeat(80));
        console.log('✅ Check complete - No changes were made');
        console.log('='.repeat(80));

        process.exit(0);

    } catch (error) {
        console.error('\n❌ Error during check:');
        console.error(error);
        console.error('\nDetails:', error.message);
        process.exit(1);
    }
}

// Run the check
checkFootballBudgets().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
