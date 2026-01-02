/**
 * Sync football_budget and football_spent from Neon DB to Firebase
 * Makes Neon the source of truth
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
    } else {
        admin.initializeApp();
    }
}

const db = admin.firestore();
const auctionSql = neon(process.env.NEON_AUCTION_DB_URL);

async function sync() {
    const seasonId = 'SSPSLS16'; // Change if needed

    console.log('🔄 Syncing football_budget and football_spent from Neon DB to Firebase...\n');

    try {
        // Get all teams from Neon DB
        const neonTeams = await auctionSql`
            SELECT 
                id,
                name,
                season_id,
                football_budget,
                football_spent,
                football_players_count
            FROM teams
            WHERE season_id = ${seasonId}
            ORDER BY name
        `;

        console.log(`📋 Found ${neonTeams.length} teams in Neon DB\n`);

        // Ask for confirmation
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });

        readline.question('Do you want to sync all teams to Firebase? (yes/no): ', async (answer) => {
            readline.close();

            if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
                console.log('\n❌ Sync cancelled.');
                process.exit(0);
            }

            console.log('\n🔄 Syncing...\n');

            let synced = 0;
            let skipped = 0;
            let errors = 0;

            for (const team of neonTeams) {
                const teamId = team.id;
                const teamName = team.name || 'Unknown';
                const neonBudget = parseFloat(team.football_budget) || 0;
                const neonSpent = parseFloat(team.football_spent) || 0;
                const neonPlayersCount = parseInt(team.football_players_count) || 0;

                try {
                    // Find team_seasons document
                    const teamSeasonId = `${teamId}_${seasonId}`;
                    const teamSeasonRef = db.collection('team_seasons').doc(teamSeasonId);
                    const teamSeasonSnap = await teamSeasonRef.get();

                    if (!teamSeasonSnap.exists) {
                        console.log(`  ⚠️  ${teamName}: team_seasons document not found - SKIPPED`);
                        skipped++;
                        continue;
                    }

                    const currentData = teamSeasonSnap.data();
                    const currencySystem = currentData?.currency_system || 'single';
                    const isDualCurrency = currencySystem === 'dual';

                    // Prepare update data
                    const updateData = {
                        updated_at: admin.firestore.FieldValue.serverTimestamp()
                    };

                    // Update based on currency system
                    if (isDualCurrency) {
                        updateData.football_budget = neonBudget;
                        updateData.football_spent = neonSpent;
                    } else {
                        // For single currency, update the main budget/spent
                        updateData.budget = neonBudget;
                        updateData.total_spent = neonSpent;
                    }

                    // Also update players_count
                    updateData.players_count = neonPlayersCount;

                    // Update Firebase
                    await teamSeasonRef.update(updateData);

                    console.log(`  ✅ ${teamName}: Budget £${neonBudget.toFixed(2)}, Spent £${neonSpent.toFixed(2)}, Players: ${neonPlayersCount}`);
                    synced++;

                } catch (error) {
                    console.error(`  ❌ ${teamName}: ${error.message}`);
                    errors++;
                }
            }

            console.log('\n═'.repeat(100));
            console.log('📊 SYNC SUMMARY:');
            console.log(`   ✅ Synced: ${synced} teams`);
            console.log(`   ⏭️  Skipped: ${skipped} teams`);
            console.log(`   ❌ Errors: ${errors} teams`);
            console.log('═'.repeat(100));
            console.log('\n✨ Sync complete!\n');

            process.exit(0);
        });

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

sync();
