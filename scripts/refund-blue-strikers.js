require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function refundBlueStrikers() {
    const sql = neon(process.env.NEON_DATABASE_URL);

    const REFUND_AMOUNT = 0.15;
    const TEAM_NAME = 'Blue Strikers';
    const REASON = 'Refund for overpayment';

    console.log('💰 Processing refund for Blue Strikers...\n');

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
        console.log(`   Current balance: ${team.sscoin_balance} SSCoin\n`);

        // 2. Update team's SSCoin balance
        console.log('2️⃣ Updating team SSCoin balance...');
        const newBalance = parseFloat(team.sscoin_balance) + REFUND_AMOUNT;

        await sql`
      UPDATE teams
      SET sscoin_balance = ${newBalance}
      WHERE team_id = ${team.team_id}
    `;

        console.log(`   ✅ Balance updated: ${team.sscoin_balance} → ${newBalance} SSCoin\n`);

        // 3. Update realplayer budget and spent
        console.log('3️⃣ Updating realplayer budget and spent...');

        await sql`
      UPDATE realplayer
      SET 
        budget = budget + ${REFUND_AMOUNT},
        spent = spent - ${REFUND_AMOUNT}
      WHERE team_id = ${team.team_id}
    `;

        console.log(`   ✅ Budget increased by ${REFUND_AMOUNT}`);
        console.log(`   ✅ Spent decreased by ${REFUND_AMOUNT}\n`);

        // 4. Create transaction record
        console.log('4️⃣ Creating transaction record...');

        const transactionId = `txn_refund_${Date.now()}`;

        await sql`
      INSERT INTO transactions (
        transaction_id,
        team_id,
        amount,
        transaction_type,
        description,
        created_at
      ) VALUES (
        ${transactionId},
        ${team.team_id},
        ${REFUND_AMOUNT},
        'refund',
        ${REASON},
        NOW()
      )
    `;

        console.log(`   ✅ Transaction created: ${transactionId}\n`);

        // 5. Verify the changes
        console.log('5️⃣ Verifying changes...');

        const updatedTeam = await sql`
      SELECT team_id, team_name, sscoin_balance
      FROM teams
      WHERE team_id = ${team.team_id}
    `;

        const updatedRealplayer = await sql`
      SELECT budget, spent
      FROM realplayer
      WHERE team_id = ${team.team_id}
    `;

        console.log('   Team:');
        console.log(`     SSCoin Balance: ${updatedTeam[0].sscoin_balance}`);
        console.log('   Realplayer:');
        console.log(`     Budget: ${updatedRealplayer[0].budget}`);
        console.log(`     Spent: ${updatedRealplayer[0].spent}\n`);

        // 6. Summary
        console.log('='.repeat(50));
        console.log('✅ Refund completed successfully!');
        console.log('='.repeat(50));
        console.log(`Team: ${team.team_name}`);
        console.log(`Refund Amount: ${REFUND_AMOUNT} SSCoin`);
        console.log(`New Balance: ${updatedTeam[0].sscoin_balance} SSCoin`);
        console.log(`Transaction ID: ${transactionId}`);
        console.log(`Reason: ${REASON}`);

    } catch (error) {
        console.error('❌ Error processing refund:', error);
        console.error('Full error:', error.message);
    }
}

refundBlueStrikers();
