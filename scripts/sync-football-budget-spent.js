/**
 * Sync football_budget and football_spent from Firebase to Neon DB
 * Makes Firebase the source of truth
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

    console.log('🔄 Syncing football_budget and football_spent from Firebase to Neon DB...\n');

    try {
        // Get all team_seasons from Firebase
        const teamSeasonsSnapshot = await db
            .collection('team_seasons')
            .where('season_id', '==', seasonId)
            .where('status', '==', 'registered')
            .get();

        console.log(`📋 Found ${teamSeasonsSnapshot.size} teams in Firebase\n`);

        // Ask for confirmation
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });

        readline.question('Do you want to sync all teams to Neon DB? (yes/no): ', async (answer) => {
            readline.close();

            if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
                console.log('\n❌ Sync cancelled.');
                process.exit(0);
            }

            console.log('\n🔄 Syncing...\n');

            let synced = 0;
            let skipped = 0;
            let errors = 0;

            for (const doc of teamSeasonsSnapshot.docs) {
                const data = doc.data();
                const teamId = data.team_id;
                const teamName = data.team_name || 'Unknown';
                const firebaseBudget = data.football_budget || 0;
                const firebaseSpent = data.football_spent || 0;

                try {
                    // Check if team exists in Neon
                    const existing = await auctionSql`
            SELECT id FROM teams WHERE id = ${teamId} LIMIT 1
          `;

                    if (existing.length === 0) {
                        console.log(`  ⚠️  ${teamName}: Not found in Neon DB - SKIPPED`);
                        skipped++;
                        continue;
                    }

                    // Update Neon DB
                    await auctionSql`
            UPDATE teams
            SET 
              football_budget = ${firebaseBudget},
              football_spent = ${firebaseSpent},
              updated_at = NOW()
            WHERE id = ${teamId}
          `;

                    console.log(`  ✅ ${teamName}: Budget €${firebaseBudget.toFixed(2)}, Spent €${firebaseSpent.toFixed(2)}`);
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
