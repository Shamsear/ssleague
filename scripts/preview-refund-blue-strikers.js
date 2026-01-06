require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function previewRefundBlueStrikers() {
    const sql = neon(process.env.NEON_DATABASE_URL);

    const REFUND_AMOUNT = 0.15;
    const TEAM_NAME = 'Blue Strikers';
    const REASON = 'Refund for overpayment';

    console.log('👁️  PREVIEW MODE - No changes will be made\n');
    console.log('💰 Refund Preview for Blue Strikers...\n');

    try {
        // 1. Find the Blue Strikers team
        console.log('1️⃣ Finding Blue Strikers team...');
        const teams = await sql`
      SELECT team_id, team_name, sscoin_balance
      FROM teams
      WHERE team_name = ${TEAM_NAME}
      LIMIT 1
    `;

        if (teams.length === 0) {
            console.log('❌ Blue Strikers team not found');
            return;
        }

        const team = teams[0];
        console.log(`   ✅ Found: ${team.team_name} (ID: ${team.team_id})`);
        console.log(`   Current SSCoin balance: ${team.sscoin_balance}\n`);

        // 2. Get current realplayer data
        console.log('2️⃣ Getting current realplayer data...');
        const realplayer = await sql`
      SELECT budget, spent
      FROM realplayer
      WHERE team_id = ${team.team_id}
    `;

        if (realplayer.length === 0) {
            console.log('   ⚠️  No realplayer record found');
        } else {
            console.log(`   Current budget: ${realplayer[0].budget}`);
            console.log(`   Current spent: ${realplayer[0].spent}\n`);
        }

        // 3. Calculate new values
        console.log('3️⃣ Calculating new values...');
        const currentBalance = parseFloat(team.sscoin_balance) || 0;
        const newBalance = currentBalance + REFUND_AMOUNT;

        const currentBudget = realplayer.length > 0 ? parseFloat(realplayer[0].budget) || 0 : 0;
        const newBudget = currentBudget + REFUND_AMOUNT;

        const currentSpent = realplayer.length > 0 ? parseFloat(realplayer[0].spent) || 0 : 0;
        const newSpent = currentSpent - REFUND_AMOUNT;

        console.log(`   SSCoin Balance: ${currentBalance} → ${newBalance} (+${REFUND_AMOUNT})`);
        console.log(`   Budget: ${currentBudget} → ${newBudget} (+${REFUND_AMOUNT})`);
        console.log(`   Spent: ${currentSpent} → ${newSpent} (-${REFUND_AMOUNT})\n`);

        // 4. Show what transaction would be created
        console.log('4️⃣ Transaction that would be created:');
        const transactionId = `txn_refund_${Date.now()}`;
        console.log(`   Transaction ID: ${transactionId}`);
        console.log(`   Team: ${team.team_name} (${team.team_id})`);
        console.log(`   Amount: ${REFUND_AMOUNT} SSCoin`);
        console.log(`   Type: refund`);
        console.log(`   Description: ${REASON}\n`);

        // 5. Summary
        console.log('='.repeat(60));
        console.log('📋 PREVIEW SUMMARY');
        console.log('='.repeat(60));
        console.log(`Team: ${team.team_name}`);
        console.log(`Refund Amount: ${REFUND_AMOUNT} SSCoin`);
        console.log('');
        console.log('Changes that would be made:');
        console.log('  1. Team SSCoin Balance:');
        console.log(`     ${currentBalance} → ${newBalance}`);
        console.log('  2. Realplayer Budget:');
        console.log(`     ${currentBudget} → ${newBudget}`);
        console.log('  3. Realplayer Spent:');
        console.log(`     ${currentSpent} → ${newSpent}`);
        console.log('  4. New transaction record created');
        console.log('');
        console.log('='.repeat(60));
        console.log('👁️  PREVIEW ONLY - No actual changes made');
        console.log('='.repeat(60));
        console.log('');
        console.log('To execute the refund, run:');
        console.log('  node scripts/refund-blue-strikers.js');

    } catch (error) {
        console.error('❌ Error during preview:', error);
        console.error('Full error:', error.message);
    }
}

previewRefundBlueStrikers();
