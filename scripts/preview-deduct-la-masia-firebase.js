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

async function previewDeductLaMasia() {
    const DEDUCTION_AMOUNT = 0.18;
    const TEAM_NAME = 'La Masia';
    const SEASON_ID = 'SSPSLS16';
    const REASON = 'Deduction for overpayment correction';

    console.log('👁️  PREVIEW MODE - No changes will be made\n');
    console.log('💸 Deduction Preview for La Masia FC...\n');

    try {
        // 1. Find the La Masia FC team_season document
        console.log('1️⃣ Finding La Masia FC team_season...');
        const teamSeasonsSnapshot = await db
            .collection('team_seasons')
            .where('team_name', '==', TEAM_NAME)
            .where('season_id', '==', SEASON_ID)
            .limit(1)
            .get();

        if (teamSeasonsSnapshot.empty) {
            console.log('❌ La Masia FC team_season not found');
            return;
        }

        const doc = teamSeasonsSnapshot.docs[0];
        const data = doc.data();
        const docId = doc.id;

        console.log(`   ✅ Found: ${data.team_name}`);
        console.log(`   Document ID: ${docId}`);
        console.log(`   Team ID: ${data.team_id}`);
        console.log(`   Season ID: ${data.season_id}\n`);

        // 2. Show current values
        console.log('2️⃣ Current values:');
        const currentRealplayerBudget = data.real_player_budget || 0;
        const currentRealplayerSpent = data.real_player_spent || 0;

        console.log(`   Real Player Budget: €${currentRealplayerBudget.toFixed(2)}`);
        console.log(`   Real Player Spent: €${currentRealplayerSpent.toFixed(2)}\n`);

        // 3. Calculate new values
        console.log('3️⃣ Calculating new values...');
        const newRealplayerBudget = currentRealplayerBudget - DEDUCTION_AMOUNT;
        const newRealplayerSpent = currentRealplayerSpent + DEDUCTION_AMOUNT;

        console.log(`   Real Player Budget: €${currentRealplayerBudget.toFixed(2)} → €${newRealplayerBudget.toFixed(2)} (-€${DEDUCTION_AMOUNT})`);
        console.log(`   Real Player Spent: €${currentRealplayerSpent.toFixed(2)} → €${newRealplayerSpent.toFixed(2)} (+€${DEDUCTION_AMOUNT})\n`);

        // 4. Show what transaction would be created
        console.log('4️⃣ Transaction that would be created:');
        const transactionId = `txn_deduction_${Date.now()}`;
        console.log(`   Collection: transactions (main collection)`);
        console.log(`   Document ID: ${transactionId}`);
        console.log(`   Team: ${data.team_name} (${data.team_id})`);
        console.log(`   Season: ${SEASON_ID}`);
        console.log(`   Amount: -€${DEDUCTION_AMOUNT} (negative for deduction)`);
        console.log(`   Type: deduction`);
        console.log(`   Description: ${REASON}\n`);

        // 5. Summary
        console.log('='.repeat(70));
        console.log('📋 PREVIEW SUMMARY');
        console.log('='.repeat(70));
        console.log(`Team: ${data.team_name}`);
        console.log(`Season: ${SEASON_ID}`);
        console.log(`Document ID: ${docId}`);
        console.log(`Deduction Amount: €${DEDUCTION_AMOUNT}`);
        console.log('');
        console.log('Changes that would be made in Firebase:');
        console.log('');
        console.log('1. Update team_seasons document:');
        console.log(`   Collection: team_seasons`);
        console.log(`   Document: ${docId}`);
        console.log('   Fields:');
        console.log(`     - real_player_budget: €${currentRealplayerBudget.toFixed(2)} → €${newRealplayerBudget.toFixed(2)}`);
        console.log(`     - real_player_spent: €${currentRealplayerSpent.toFixed(2)} → €${newRealplayerSpent.toFixed(2)}`);
        console.log('');
        console.log('2. Create transaction document:');
        console.log(`   Collection: transactions (main collection)`);
        console.log(`   Document: ${transactionId}`);
        console.log(`   Fields: team_id, team_name, season_id, amount (-${DEDUCTION_AMOUNT}), type, description, created_at`);
        console.log('');
        console.log('='.repeat(70));
        console.log('👁️  PREVIEW ONLY - No actual changes made');
        console.log('='.repeat(70));
        console.log('');
        console.log('To execute the deduction, run:');
        console.log('  node scripts/deduct-la-masia-firebase.js');

        process.exit(0);

    } catch (error) {
        console.error('❌ Error during preview:', error);
        console.error('Full error:', error.message);
        process.exit(1);
    }
}

previewDeductLaMasia();
