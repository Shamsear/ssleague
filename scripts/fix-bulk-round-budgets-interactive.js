/**
 * Interactive script to fix missing budget deductions from bulk round
 * Shows preview for each team and allows fixing one by one
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const readline = require('readline');

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

async function fixBulkRoundBudgets(roundId = 'SSPSLFBR00008') {
  console.log(`\n${'='.repeat(100)}`);
  console.log(`INTERACTIVE BUDGET FIX FOR BULK ROUND ${roundId}`);
  console.log(`${'='.repeat(100)}\n`);

  try {
    // Get round info
    const roundInfo = await sql`
      SELECT id, round_number, base_price, season_id, status
      FROM rounds
      WHERE id = ${roundId}
    `;

    if (roundInfo.length === 0) {
      console.log('❌ Round not found');
      rl.close();
      return;
    }

    const round = roundInfo[0];
    console.log(`Round: #${round.round_number} | Base Price: £${round.base_price} | Season: ${round.season_id}\n`);

    // Get all sold players (immediate + tiebreakers)
    const immediateSales = await sql`
      SELECT 
        rp.player_id,
        rp.player_name,
        rp.position,
        rp.winning_team_id,
        rp.winning_bid,
        'immediate' as type
      FROM round_players rp
      WHERE rp.round_id = ${roundId}
      AND rp.status = 'sold'
      AND rp.winning_team_id IS NOT NULL
    `;

    const tiebreakerWins = await sql`
      SELECT 
        bt.player_id,
        bt.player_name,
        bt.player_position as position,
        bt.current_highest_team_id as winning_team_id,
        bt.current_highest_bid as winning_bid,
        'tiebreaker' as type
      FROM bulk_tiebreakers bt
      WHERE bt.bulk_round_id = ${roundId}
      AND bt.status = 'resolved'
    `;

    const allSales = [...immediateSales, ...tiebreakerWins];

    // Group by team
    const teamSales = new Map();
    for (const sale of allSales) {
      const teamId = sale.winning_team_id;
      if (!teamSales.has(teamId)) {
        teamSales.set(teamId, { players: [], total: 0 });
      }
      const data = teamSales.get(teamId);
      data.players.push({
        name: sale.player_name,
        position: sale.position,
        amount: parseFloat(sale.winning_bid),
        type: sale.type
      });
      data.total += parseFloat(sale.winning_bid);
    }

    // Get team info
    const teamIds = Array.from(teamSales.keys());
    const teams = await sql`
      SELECT 
        id,
        name,
        football_budget,
        football_spent,
        firebase_uid
      FROM teams
      WHERE id = ANY(${teamIds})
      AND season_id = ${round.season_id}
    `;

    const teamInfoMap = new Map(teams.map(t => [t.id, t]));

    console.log(`Found ${teams.length} teams with purchases in this round\n`);

    let fixedCount = 0;
    let skippedCount = 0;

    // Process each team
    for (const [teamId, sales] of teamSales) {
      const teamInfo = teamInfoMap.get(teamId);
      if (!teamInfo) {
        console.log(`\n❌ Team ${teamId} not found - skipping`);
        continue;
      }

      console.log(`\n${'▼'.repeat(100)}`);
      console.log(`TEAM: ${teamInfo.name} (${teamId})`);
      console.log(`${'▼'.repeat(100)}`);

      // Show current state
      console.log(`\n📊 CURRENT STATE (Neon):`);
      console.log(`   Budget: £${teamInfo.football_budget}`);
      console.log(`   Spent: £${teamInfo.football_spent}`);

      // Show players acquired
      console.log(`\n🛒 PLAYERS ACQUIRED (${sales.players.length} total):`);
      console.log('-'.repeat(100));
      
      let immediateTotal = 0;
      let tiebreakerTotal = 0;

      for (const player of sales.players) {
        const typeLabel = player.type === 'immediate' ? '✅' : '🏆';
        console.log(`   ${typeLabel} ${player.name.padEnd(40)} ${player.position.padEnd(5)} £${player.amount}`);
        
        if (player.type === 'immediate') {
          immediateTotal += player.amount;
        } else {
          tiebreakerTotal += player.amount;
        }
      }

      console.log('-'.repeat(100));
      console.log(`   Immediate (✅): £${immediateTotal}`);
      console.log(`   Tiebreaker (🏆): £${tiebreakerTotal}`);
      console.log(`   TOTAL: £${sales.total}`);

      // Calculate what should be
      const newBudget = parseFloat(teamInfo.football_budget) - sales.total;
      const newSpent = parseFloat(teamInfo.football_spent) + sales.total;

      console.log(`\n💡 AFTER DEDUCTION:`);
      console.log(`   Budget: £${teamInfo.football_budget} → £${newBudget.toFixed(2)} (${sales.total < 0 ? '+' : '-'}£${Math.abs(sales.total)})`);
      console.log(`   Spent: £${teamInfo.football_spent} → £${newSpent.toFixed(2)} (+£${sales.total})`);

      // Show SQL that will be executed
      console.log(`\n📝 SQL TO EXECUTE:`);
      console.log(`   UPDATE teams`);
      console.log(`   SET football_budget = football_budget - ${sales.total},`);
      console.log(`       football_spent = football_spent + ${sales.total},`);
      console.log(`       updated_at = NOW()`);
      console.log(`   WHERE id = '${teamId}' AND season_id = '${round.season_id}';`);

      console.log(`\n📝 FIREBASE UPDATE NEEDED:`);
      console.log(`   Document: team_seasons/${teamId}_${round.season_id}`);
      console.log(`   football_budget: DECREASE by £${sales.total}`);
      console.log(`   football_spent: INCREASE by £${sales.total}`);

      // Ask for confirmation
      const answer = await question(`\n❓ Fix this team's budget? (yes/no/quit): `);

      if (answer.toLowerCase() === 'quit' || answer.toLowerCase() === 'q') {
        console.log('\n⏹️  Stopping...');
        break;
      }

      if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
        try {
          // Update Neon
          await sql`
            UPDATE teams
            SET 
              football_budget = football_budget - ${sales.total},
              football_spent = football_spent + ${sales.total},
              updated_at = NOW()
            WHERE id = ${teamId}
            AND season_id = ${round.season_id}
          `;

          console.log(`\n✅ Neon database updated successfully!`);

          // Verify the update
          const verifyResult = await sql`
            SELECT football_budget, football_spent
            FROM teams
            WHERE id = ${teamId}
            AND season_id = ${round.season_id}
          `;

          if (verifyResult.length > 0) {
            console.log(`   Verified - Budget: £${verifyResult[0].football_budget}, Spent: £${verifyResult[0].football_spent}`);
          }

          console.log(`\n⚠️  REMINDER: You still need to update Firebase manually:`);
          console.log(`   Go to: team_seasons/${teamId}_${round.season_id}`);
          console.log(`   Decrease football_budget by £${sales.total}`);
          console.log(`   Increase football_spent by £${sales.total}`);

          fixedCount++;
        } catch (error) {
          console.error(`\n❌ Error updating team:`, error.message);
        }
      } else {
        console.log(`\n⏭️  Skipped ${teamInfo.name}`);
        skippedCount++;
      }

      console.log(`\n${'▲'.repeat(100)}\n`);
    }

    // Summary
    console.log(`\n${'='.repeat(100)}`);
    console.log(`SUMMARY`);
    console.log(`${'='.repeat(100)}`);
    console.log(`Teams processed: ${teams.length}`);
    console.log(`Fixed: ${fixedCount}`);
    console.log(`Skipped: ${skippedCount}`);
    console.log(`${'='.repeat(100)}\n`);

    if (fixedCount > 0) {
      console.log(`✅ ${fixedCount} team(s) updated in Neon database`);
      console.log(`⚠️  Don't forget to update Firebase for these teams!`);
      console.log(`   You can use the budget sync page: /dashboard/committee/reports/budget-sync\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    rl.close();
  }
}

// Get round ID from command line or use default
const roundId = process.argv[2] || 'SSPSLFBR00008';

// Run the script
fixBulkRoundBudgets(roundId)
  .then(() => {
    console.log('✅ Script completed\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    rl.close();
    process.exit(1);
  });
