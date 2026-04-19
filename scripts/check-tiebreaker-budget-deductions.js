/**
 * Check if budget deductions were made for resolved tiebreakers
 * Compares expected vs actual budgets and spent amounts
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

async function checkTiebreakerBudgets(roundId = 'SSPSLFBR00008') {
  console.log(`🔍 Checking budget deductions for bulk round ${roundId}...\n`);

  try {
    // Get all resolved tiebreakers for this round
    const tiebreakers = await sql`
      SELECT 
        bt.id,
        bt.player_id,
        bt.player_name,
        bt.player_position,
        bt.current_highest_team_id as winner_team_id,
        bt.current_highest_bid as winning_amount,
        bt.bulk_round_id,
        bt.resolved_at,
        r.season_id
      FROM bulk_tiebreakers bt
      JOIN rounds r ON bt.bulk_round_id = r.id
      WHERE bt.bulk_round_id = ${roundId}
      AND bt.status = 'resolved'
      ORDER BY bt.resolved_at
    `;

    console.log(`📊 Found ${tiebreakers.length} resolved tiebreakers\n`);

    if (tiebreakers.length === 0) {
      console.log('✅ No resolved tiebreakers found.');
      return;
    }

    // Group by team to calculate total amounts
    const teamTotals = new Map();
    
    for (const tb of tiebreakers) {
      if (!teamTotals.has(tb.winner_team_id)) {
        teamTotals.set(tb.winner_team_id, {
          teamId: tb.winner_team_id,
          seasonId: tb.season_id,
          players: [],
          totalAmount: 0
        });
      }
      
      const teamData = teamTotals.get(tb.winner_team_id);
      teamData.players.push({
        name: tb.player_name,
        position: tb.player_position,
        amount: parseInt(tb.winning_amount)
      });
      teamData.totalAmount += parseInt(tb.winning_amount);
    }

    console.log('='.repeat(80));
    console.log('TIEBREAKER WINS BY TEAM');
    console.log('='.repeat(80));

    const deductionReport = [];

    for (const [teamId, data] of teamTotals) {
      // Get team info from Neon
      const teamInfo = await sql`
        SELECT 
          id,
          name,
          football_budget,
          football_spent,
          firebase_uid
        FROM teams
        WHERE id = ${teamId}
        AND season_id = ${data.seasonId}
        LIMIT 1
      `;

      if (teamInfo.length === 0) {
        console.log(`\n❌ Team ${teamId} not found in Neon`);
        continue;
      }

      const team = teamInfo[0];
      const currentBudget = parseFloat(team.football_budget);
      const currentSpent = parseFloat(team.football_spent);

      console.log(`\n📋 ${team.name} (${teamId})`);
      console.log('-'.repeat(80));
      
      for (const player of data.players) {
        console.log(`   ${player.name} (${player.position}) - £${player.amount}`);
      }
      
      console.log('-'.repeat(80));
      console.log(`   Total tiebreaker wins: £${data.totalAmount}`);
      console.log(`   Current Neon budget: £${currentBudget}`);
      console.log(`   Current Neon spent: £${currentSpent}`);

      deductionReport.push({
        teamId: teamId,
        teamName: team.name,
        firebaseUid: team.firebase_uid,
        seasonId: data.seasonId,
        players: data.players,
        totalAmount: data.totalAmount,
        neonBudget: currentBudget,
        neonSpent: currentSpent
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('BUDGET DEDUCTION SUMMARY');
    console.log('='.repeat(80));
    console.log('\nAmounts that should have been deducted:\n');

    let totalToDeduct = 0;

    for (const report of deductionReport) {
      console.log(`${report.teamName}:`);
      console.log(`  Should deduct from budget: £${report.totalAmount}`);
      console.log(`  Should add to spent: £${report.totalAmount}`);
      console.log(`  Players: ${report.players.length}`);
      totalToDeduct += report.totalAmount;
    }

    console.log('\n' + '='.repeat(80));
    console.log(`TOTAL ACROSS ALL TEAMS: £${totalToDeduct}`);
    console.log('='.repeat(80));

    // Generate SQL to fix Neon
    console.log('\n\n📝 SQL TO FIX NEON DATABASE:');
    console.log('='.repeat(80));
    console.log('-- Copy and run these SQL statements in your Neon console\n');

    for (const report of deductionReport) {
      console.log(`-- ${report.teamName}: Deduct £${report.totalAmount}`);
      console.log(`UPDATE teams`);
      console.log(`SET `);
      console.log(`  football_budget = football_budget - ${report.totalAmount},`);
      console.log(`  football_spent = football_spent + ${report.totalAmount},`);
      console.log(`  updated_at = NOW()`);
      console.log(`WHERE id = '${report.teamId}'`);
      console.log(`AND season_id = '${report.seasonId}';`);
      console.log('');
    }

    // Generate Firebase update instructions
    console.log('\n📝 FIREBASE UPDATES NEEDED:');
    console.log('='.repeat(80));
    console.log('For each team, update the team_seasons document:\n');

    for (const report of deductionReport) {
      const teamSeasonId = `${report.teamId}_${report.seasonId}`;
      console.log(`Document: team_seasons/${teamSeasonId}`);
      console.log(`  football_budget: DECREASE by £${report.totalAmount}`);
      console.log(`  football_spent: INCREASE by £${report.totalAmount}`);
      console.log(`  Players won: ${report.players.map(p => p.name).join(', ')}`);
      console.log('');
    }

    console.log('='.repeat(80));
    console.log('\n⚠️  IMPORTANT: Review these amounts carefully before applying!');
    console.log('⚠️  Make sure these deductions have not already been applied.');
    console.log('⚠️  You can use the budget sync page to verify current balances.\n');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Get round ID from command line or use default
const roundId = process.argv[2] || 'SSPSLFBR00008';

// Run the script
checkTiebreakerBudgets(roundId)
  .then(() => {
    console.log('\n✅ Analysis completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
