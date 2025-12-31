/**
 * PREVIEW ONLY - Shows what will be reversed/deleted
 * This will NOT make any changes to the database
 */

const admin = require('firebase-admin');
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

async function main() {
    const seasonId = 'SSPSLS16'; // Change this if needed

    console.log('🔍 PREVIEW MODE - Finding teams with recent salary deductions...\n');
    console.log('⚠️  This is a PREVIEW ONLY - NO changes will be made!\n');

    try {
        // Get all team_seasons for this season
        const teamSeasonsSnapshot = await db
            .collection('team_seasons')
            .where('season_id', '==', seasonId)
            .where('status', '==', 'registered')
            .get();

        const teamsWithDeductions = [];

        for (const doc of teamSeasonsSnapshot.docs) {
            const data = doc.data();
            if (data.last_salary_deduction) {
                // Find matching transactions
                const transactionsSnapshot = await db
                    .collection('transactions')
                    .where('team_id', '==', data.team_id)
                    .where('season_id', '==', seasonId)
                    .where('transaction_type', '==', 'salary_payment')
                    .get();

                const matchingTransactions = [];
                const deductionAmount = data.last_salary_deduction.amount || 0;
                const deductionRound = data.last_salary_deduction.round;

                transactionsSnapshot.forEach(txDoc => {
                    const txData = txDoc.data();
                    if (txData.amount === -deductionAmount ||
                        (txData.metadata && txData.metadata.round === deductionRound)) {
                        matchingTransactions.push({
                            id: txDoc.id,
                            amount: txData.amount,
                            date: txData.created_at?.toDate?.() || 'Unknown',
                            description: txData.description || 'No description',
                        });
                    }
                });

                teamsWithDeductions.push({
                    id: doc.id,
                    teamId: data.team_id,
                    teamName: data.team_name,
                    currentBalance: data.football_budget || 0,
                    lastDeduction: data.last_salary_deduction,
                    footballSpent: data.football_spent || 0,
                    transactions: matchingTransactions,
                });
            }
        }

        if (teamsWithDeductions.length === 0) {
            console.log('✅ No teams found with salary deductions to reverse.\n');
            process.exit(0);
        }

        console.log(`📋 Found ${teamsWithDeductions.length} team(s) with salary deductions:\n`);
        console.log('═'.repeat(120));

        let totalRefund = 0;
        let totalTransactions = 0;

        teamsWithDeductions.forEach(team => {
            const deductionAmount = team.lastDeduction.amount || 0;
            const newBalance = team.currentBalance + deductionAmount;
            totalRefund += deductionAmount;
            totalTransactions += team.transactions.length;

            console.log(`\n🏢 ${team.teamName}`);
            console.log('─'.repeat(120));
            console.log(`   Team ID: ${team.teamId}`);
            console.log(`   Current Balance: €${team.currentBalance.toFixed(2)}`);
            console.log(`   Deduction Amount: €${deductionAmount.toFixed(2)}`);
            console.log(`   New Balance (after refund): €${newBalance.toFixed(2)}`);
            console.log(`   Deduction Round: ${team.lastDeduction.round || 'Unknown'}`);
            console.log(`   Deduction Date: ${team.lastDeduction.date?.toDate?.() || 'Unknown'}`);

            if (team.transactions.length > 0) {
                console.log(`\n   📝 Transactions to DELETE (${team.transactions.length}):`);
                team.transactions.forEach((tx, idx) => {
                    console.log(`      ${idx + 1}. Amount: €${tx.amount.toFixed(2)} | Date: ${tx.date} | ${tx.description}`);
                });
            } else {
                console.log(`\n   ⚠️  No matching transactions found to delete!`);
            }
        });

        console.log('\n' + '═'.repeat(120));
        console.log('\n📊 SUMMARY:');
        console.log(`   Teams to refund: ${teamsWithDeductions.length}`);
        console.log(`   Total refund amount: €${totalRefund.toFixed(2)}`);
        console.log(`   Total transactions to DELETE: ${totalTransactions}`);
        console.log('\n═'.repeat(120));

        console.log('\n✅ PREVIEW COMPLETE - No changes were made to the database.');
        console.log('💡 To actually perform the refund, run: node scripts/reverse-salary-deductions.js\n');

        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

main();
