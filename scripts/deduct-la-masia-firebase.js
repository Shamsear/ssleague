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

async function deductLaMasia() {
    const DEDUCTION_AMOUNT = 0.18;
    const TEAM_NAME = 'La Masia';
    const SEASON_ID = 'SSPSLS16';
    const REASON = 'Deduction for overpayment correction';

    console.log('💸 Processing deduction for La Masia FC...\n');

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
            process.exit(1);
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
        const newRealplayerBudget = currentRealplayerBudget - DEDUCTION_AMOUNT;
        const newRealplayerSpent = currentRealplayerSpent + DEDUCTION_AMOUNT;

        // 4. Update team_season document
        console.log('3️⃣ Updating team_season document...');
        await doc.ref.update({
            real_player_budget: newRealplayerBudget,
            real_player_spent: newRealplayerSpent,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`   ✅ Real Player Budget: €${currentRealplayerBudget.toFixed(2)} → €${newRealplayerBudget.toFixed(2)}`);
        console.log(`   ✅ Real Player Spent: €${currentRealplayerSpent.toFixed(2)} → €${newRealplayerSpent.toFixed(2)}\n`);

        // 5. Create transaction record in main transactions collection
        console.log('4️⃣ Creating transaction record...');
        const transactionId = `txn_deduction_${Date.now()}`;

        await db.collection('transactions').doc(transactionId).set({
            transaction_id: transactionId,
            team_id: data.team_id,
            team_name: data.team_name,
            season_id: data.season_id,
            amount: -DEDUCTION_AMOUNT, // Negative for deduction
            transaction_type: 'deduction',
            description: REASON,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            created_by: 'admin'
        });

        console.log(`   ✅ Transaction created in main 'transactions' collection`);
        console.log(`   Transaction ID: ${transactionId}\n`);

        // 6. Verify the changes
        console.log('5️⃣ Verifying changes...');
        const updatedDoc = await doc.ref.get();
        const updatedData = updatedDoc.data();

        console.log('   Updated values:');
        console.log(`     Real Player Budget: €${updatedData.real_player_budget.toFixed(2)}`);
        console.log(`     Real Player Spent: €${updatedData.real_player_spent.toFixed(2)}\n`);

        // 7. Summary
        console.log('='.repeat(70));
        console.log('✅ Deduction completed successfully!');
        console.log('='.repeat(70));
        console.log(`Team: ${data.team_name}`);
        console.log(`Season: ${SEASON_ID}`);
        console.log(`Document ID: ${docId}`);
        console.log(`Deduction Amount: €${DEDUCTION_AMOUNT}`);
        console.log('');
        console.log('Updated Fields:');
        console.log(`  Real Player Budget: €${updatedData.real_player_budget.toFixed(2)}`);
        console.log(`  Real Player Spent: €${updatedData.real_player_spent.toFixed(2)}`);
        console.log('');
        console.log(`Transaction ID: ${transactionId}`);
        console.log(`Transaction Location: transactions/${transactionId}`);
        console.log(`Transaction Amount: -€${DEDUCTION_AMOUNT} (negative)`);
        console.log(`Reason: ${REASON}`);
        console.log('='.repeat(70));

        process.exit(0);

    } catch (error) {
        console.error('❌ Error processing deduction:', error);
        console.error('Full error:', error.message);
        process.exit(1);
    }
}

deductLaMasia();
