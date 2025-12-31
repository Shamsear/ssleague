/**
 * Script to reverse/refund salary deductions
 * This will restore the balance for teams and DELETE the wrong transactions
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

async function main() {
    const seasonId = 'SSPSLS16'; // Change this if needed

    console.log('🔍 Finding teams with recent salary deductions...\n');

    try {
        // Get all team_seasons for this season
        const teamSeasonsSnapshot = await db
            .collection('team_seasons')
            .where('season_id', '==', seasonId)
            .where('status', '==', 'registered')
            .get();

        const teamsWithDeductions = [];

        teamSeasonsSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.last_salary_deduction) {
                teamsWithDeductions.push({
                    id: doc.id,
                    teamId: data.team_id,
                    teamName: data.team_name,
                    currentBalance: data.football_budget || 0,
                    lastDeduction: data.last_salary_deduction,
                    footballSpent: data.football_spent || 0,
                });
            }
        });

        if (teamsWithDeductions.length === 0) {
            console.log('✅ No teams found with salary deductions to reverse.\n');
            process.exit(0);
        }

        console.log(`📋 Found ${teamsWithDeductions.length} team(s) with salary deductions:\n`);
        console.log('═'.repeat(100));
        console.log('Team Name'.padEnd(30) + 'Current Balance'.padEnd(20) + 'Last Deduction'.padEnd(20) + 'Refund To');
        console.log('═'.repeat(100));

        let totalRefund = 0;
        teamsWithDeductions.forEach(team => {
            const deductionAmount = team.lastDeduction.amount || 0;
            const newBalance = team.currentBalance + deductionAmount;
            totalRefund += deductionAmount;

            console.log(
                team.teamName.padEnd(30) +
                `€${team.currentBalance.toFixed(2)}`.padEnd(20) +
                `€${deductionAmount.toFixed(2)}`.padEnd(20) +
                `€${newBalance.toFixed(2)}`
            );
        });

        console.log('═'.repeat(100));
        console.log(`\n💰 Total Refund: €${totalRefund.toFixed(2)}`);
        console.log(`📊 Teams to refund: ${teamsWithDeductions.length}`);
        console.log(`🗑️  Transactions will be DELETED (not reversed)\n`);

        // Ask for confirmation
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });

        readline.question('Do you want to proceed with the refund and DELETE transactions? (yes/no): ', async (answer) => {
            readline.close();

            if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
                console.log('\n❌ Refund cancelled.');
                process.exit(0);
            }

            console.log('\n🔄 Processing refunds and deleting transactions...\n');

            let refunded = 0;
            let transactionsDeleted = 0;
            const errors = [];

            for (const team of teamsWithDeductions) {
                try {
                    const deductionAmount = team.lastDeduction.amount || 0;
                    const deductionRound = team.lastDeduction.round;
                    const newBalance = team.currentBalance + deductionAmount;
                    const newFootballSpent = Math.max(0, team.footballSpent - deductionAmount);

                    // Find and delete the salary transaction(s)
                    const transactionsSnapshot = await db
                        .collection('transactions')
                        .where('team_id', '==', team.teamId)
                        .where('season_id', '==', seasonId)
                        .where('transaction_type', '==', 'salary_payment')
                        .get();

                    let deletedCount = 0;
                    for (const txDoc of transactionsSnapshot.docs) {
                        const txData = txDoc.data();
                        // Delete if it matches the last deduction
                        if (txData.amount === -deductionAmount ||
                            (txData.metadata && txData.metadata.round === deductionRound)) {
                            await txDoc.ref.delete();
                            deletedCount++;
                        }
                    }

                    // Update team_seasons document in Firebase
                    await db.collection('team_seasons').doc(team.id).update({
                        football_budget: newBalance,
                        football_spent: newFootballSpent,
                        last_salary_deduction: null, // Clear the deduction record
                        updated_at: new Date(),
                    });

                    // Also update auction DB
                    try {
                        await auctionSql`
              UPDATE teams
              SET 
                football_budget = ${newBalance},
                updated_at = NOW()
              WHERE id = ${team.teamId}
            `;
                    } catch (auctionDbError) {
                        console.warn(`    ⚠️  Auction DB sync failed:`, auctionDbError.message);
                    }

                    console.log(`  ✅ ${team.teamName}: €${team.currentBalance.toFixed(2)} → €${newBalance.toFixed(2)} (${deletedCount} transaction(s) deleted)`);
                    refunded++;
                    transactionsDeleted += deletedCount;
                } catch (error) {
                    const msg = `${team.teamName}: ${error.message}`;
                    console.error(`  ❌ ${msg}`);
                    errors.push(msg);
                }
            }

            console.log('\n═'.repeat(100));
            console.log('📊 Summary:');
            console.log(`  ✅ Teams refunded: ${refunded}`);
            console.log(`  💶 Total refunded: €${totalRefund.toFixed(2)}`);
            console.log(`  🗑️  Transactions deleted: ${transactionsDeleted}`);
            if (errors.length > 0) {
                console.log(`  ❌ Errors: ${errors.length}`);
                errors.forEach(err => console.log(`     - ${err}`));
            }
            console.log('═'.repeat(100));
            console.log('\n✨ Refund complete! Transactions removed from history.\n');

            process.exit(0);
        });

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

main();
