/**
 * PREVIEW: Compare football_budget and football_spent between Firebase and Neon DB
 * Shows differences without making any changes
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

async function preview() {
    const seasonId = 'SSPSLS16'; // Change if needed

    console.log('🔍 PREVIEW: Comparing Firebase vs Neon DB...\n');
    console.log('⚠️  This is PREVIEW ONLY - No changes will be made!\n');

    try {
        // Get all team_seasons from Firebase
        const teamSeasonsSnapshot = await db
            .collection('team_seasons')
            .where('season_id', '==', seasonId)
            .where('status', '==', 'registered')
            .get();

        console.log(`📋 Found ${teamSeasonsSnapshot.size} teams in Firebase\n`);
        console.log('═'.repeat(140));
        console.log(
            'Team Name'.padEnd(25) +
            'Firebase Budget'.padEnd(20) +
            'Neon Budget'.padEnd(20) +
            'Diff'.padEnd(15) +
            'Firebase Spent'.padEnd(20) +
            'Neon Spent'.padEnd(20) +
            'Diff'
        );
        console.log('═'.repeat(140));

        let totalDifferences = 0;
        let budgetMismatches = 0;
        let spentMismatches = 0;

        for (const doc of teamSeasonsSnapshot.docs) {
            const data = doc.data();
            const teamId = data.team_id;
            const teamName = data.team_name || 'Unknown';
            const firebaseBudget = data.football_budget || 0;
            const firebaseSpent = data.football_spent || 0;

            // Get from Neon DB
            const neonTeam = await auctionSql`
        SELECT football_budget, football_spent
        FROM teams
        WHERE id = ${teamId}
        LIMIT 1
      `;

            if (neonTeam.length === 0) {
                console.log(`${teamName.padEnd(25)} ⚠️  NOT FOUND IN NEON DB`);
                totalDifferences++;
                continue;
            }

            const neonBudget = parseFloat(neonTeam[0].football_budget) || 0;
            const neonSpent = parseFloat(neonTeam[0].football_spent) || 0;

            const budgetDiff = firebaseBudget - neonBudget;
            const spentDiff = firebaseSpent - neonSpent;

            const hasDifference = Math.abs(budgetDiff) > 0.01 || Math.abs(spentDiff) > 0.01;

            if (hasDifference) {
                totalDifferences++;
                if (Math.abs(budgetDiff) > 0.01) budgetMismatches++;
                if (Math.abs(spentDiff) > 0.01) spentMismatches++;
            }

            const budgetStatus = Math.abs(budgetDiff) > 0.01 ? '❌' : '✅';
            const spentStatus = Math.abs(spentDiff) > 0.01 ? '❌' : '✅';

            console.log(
                teamName.padEnd(25) +
                `€${firebaseBudget.toFixed(2)}`.padEnd(20) +
                `€${neonBudget.toFixed(2)}`.padEnd(20) +
                `${budgetStatus} ${budgetDiff >= 0 ? '+' : ''}${budgetDiff.toFixed(2)}`.padEnd(15) +
                `€${firebaseSpent.toFixed(2)}`.padEnd(20) +
                `€${neonSpent.toFixed(2)}`.padEnd(20) +
                `${spentStatus} ${spentDiff >= 0 ? '+' : ''}${spentDiff.toFixed(2)}`
            );
        }

        console.log('═'.repeat(140));
        console.log('\n📊 SUMMARY:');
        console.log(`   Total teams checked: ${teamSeasonsSnapshot.size}`);
        console.log(`   Teams with differences: ${totalDifferences}`);
        console.log(`   Budget mismatches: ${budgetMismatches}`);
        console.log(`   Spent mismatches: ${spentMismatches}`);
        console.log(`   Teams in sync: ${teamSeasonsSnapshot.size - totalDifferences}`);
        console.log('═'.repeat(140));

        if (totalDifferences > 0) {
            console.log('\n⚠️  Differences found! Run sync script to fix:');
            console.log('   node scripts/sync-football-budget-spent.js\n');
        } else {
            console.log('\n✅ All teams are in sync!\n');
        }

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }

    process.exit(0);
}

preview();
