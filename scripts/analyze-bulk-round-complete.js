/**
 * Complete analysis of bulk round SSPSLFBR00008
 * Shows all sold players (immediate + tiebreakers) and budget impact per team
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

async function analyzeBulkRound(roundId = 'SSPSLFBR00008') {
  console.log(`📊 Complete Analysis of Bulk Round ${roundId}\n`);
  console.log('='.repeat(100));

  try {
    // Get round info
    const roundInfo = await sql`
      SELECT id, round_number, base_price, season_id, status
      FROM rounds
      WHERE id = ${roundId}
    `;

    if (roundInfo.length === 0) {
      console.log('❌ Round not found');
      return;
    }

    const round = roundInfo[0];
    console.log(`Round: #${round.round_number} | Base Price: £${round.base_price} | Status: ${round.status}`);
    console.log('='.repeat(100));

    // Get all sold players from round_players (immediate assignments)
    const immediateSales = await sql`
      SELECT 
        rp.player_id,
        rp.player_name,
        rp.position,
        rp.winning_team_id,
        rp.winning_bid,
        rp.status,
        'immediate' as assignment_type
      FROM round_players rp
      WHERE rp.round_id = ${roundId}
      AND rp.status = 'sold'
      AND rp.winning_team_id IS NOT NULL
      ORDER BY rp.player_name
    `;

    // Get tiebreaker wins
    const tiebreakerWins = await sql`
      SELECT 
        bt.player_id,
        bt.player_name,
        bt.player_position as position,
        bt.current_highest_team_id as winning_team_id,
        bt.current_highest_bid as winning_bid,
        bt.status,
        'tiebreaker' as assignment_type
      FROM bulk_tiebreakers bt
      WHERE bt.bulk_round_id = ${roundId}
      AND bt.status = 'resolved'
      ORDER BY bt.player_name
    `;

    console.log(`\n📈 SALES BREAKDOWN:`);
    console.log(`   Immediate assignments: ${immediateSales.length}`);
    console.log(`   Tiebreaker wins: ${tiebreakerWins.length}`);
    console.log(`   Total players sold: ${immediateSales.length + tiebreakerWins.length}`);

    // Combine all sales
    const allSales = [...immediateSales, ...tiebreakerWins];

    // Group by team
    const teamSales = new Map();

    for (const sale of allSales) {
      const teamId = sale.winning_team_id;
      if (!teamSales.has(teamId)) {
        teamSales.set(teamId, {
          teamId: teamId,
          immediate: [],
          tiebreaker: [],
          totalImmediate: 0,
          totalTiebreaker: 0,
          totalAmount: 0,
          playerCount: 0
        });
      }

      const teamData = teamSales.get(teamId);
      const amount = parseFloat(sale.winning_bid);

      if (sale.assignment_type === 'immediate') {
        teamData.immediate.push({
          name: sale.player_name,
          position: sale.position,
          amount: amount
        });
        teamData.totalImmediate += amount;
      } else {
        teamData.tiebreaker.push({
          name: sale.player_name,
          position: sale.position,
          amount: amount
        });
        teamData.totalTiebreaker += amount;
      }

      teamData.totalAmount += amount;
      teamData.playerCount++;
    }

    // Get team info and current budgets
    const teamIds = Array.from(teamSales.keys());
    const teams = await sql`
      SELECT 
        id,
        name,
        football_budget,
        football_spent,
        football_players_count
      FROM teams
      WHERE id = ANY(${teamIds})
      AND season_id = ${round.season_id}
    `;

    const teamInfoMap = new Map(teams.map(t => [t.id, t]));

    console.log('\n\n' + '='.repeat(100));
    console.log('DETAILED BREAKDOWN BY TEAM');
    console.log('='.repeat(100));

    const summary = [];

    for (const [teamId, sales] of teamSales) {
      const teamInfo = teamInfoMap.get(teamId);
      if (!teamInfo) {
        console.log(`\n❌ Team ${teamId} not found in database`);
        continue;
      }

      console.log(`\n${'▼'.repeat(50)}`);
      console.log(`📋 ${teamInfo.name} (${teamId})`);
      console.log(`${'▼'.repeat(50)}`);

      // Immediate assignments
      if (sales.immediate.length > 0) {
        console.log(`\n✅ IMMEDIATE ASSIGNMENTS (${sales.immediate.length} players):`);
        console.log('-'.repeat(100));
        for (const player of sales.immediate) {
          console.log(`   ${player.name.padEnd(40)} ${player.position.padEnd(5)} £${player.amount}`);
        }
        console.log('-'.repeat(100));
        console.log(`   Subtotal: £${sales.totalImmediate}`);
      }

      // Tiebreaker wins
      if (sales.tiebreaker.length > 0) {
        console.log(`\n🏆 TIEBREAKER WINS (${sales.tiebreaker.length} players):`);
        console.log('-'.repeat(100));
        for (const player of sales.tiebreaker) {
          console.log(`   ${player.name.padEnd(40)} ${player.position.padEnd(5)} £${player.amount}`);
        }
        console.log('-'.repeat(100));
        console.log(`   Subtotal: £${sales.totalTiebreaker}`);
      }

      // Totals
      console.log(`\n💰 TOTALS:`);
      console.log(`   Players acquired: ${sales.playerCount}`);
      console.log(`   Total spent: £${sales.totalAmount}`);
      console.log(`   - Immediate: £${sales.totalImmediate}`);
      console.log(`   - Tiebreaker: £${sales.totalTiebreaker}`);

      // Current database state
      console.log(`\n📊 CURRENT DATABASE STATE (Neon):`);
      console.log(`   Budget: £${teamInfo.football_budget}`);
      console.log(`   Spent: £${teamInfo.football_spent}`);
      console.log(`   Player count: ${teamInfo.football_players_count}`);

      summary.push({
        teamName: teamInfo.name,
        teamId: teamId,
        immediateCount: sales.immediate.length,
        immediateAmount: sales.totalImmediate,
        tiebreakerCount: sales.tiebreaker.length,
        tiebreakerAmount: sales.totalTiebreaker,
        totalPlayers: sales.playerCount,
        totalAmount: sales.totalAmount,
        currentBudget: parseFloat(teamInfo.football_budget),
        currentSpent: parseFloat(teamInfo.football_spent),
        currentPlayerCount: parseInt(teamInfo.football_players_count)
      });
    }

    // Overall summary
    console.log('\n\n' + '='.repeat(100));
    console.log('OVERALL SUMMARY');
    console.log('='.repeat(100));

    let totalImmediate = 0;
    let totalTiebreaker = 0;
    let totalPlayers = 0;

    console.log('\n' + 'Team'.padEnd(25) + 'Immediate'.padEnd(15) + 'Tiebreaker'.padEnd(15) + 'Total'.padEnd(15) + 'Players');
    console.log('-'.repeat(100));

    for (const s of summary) {
      console.log(
        s.teamName.padEnd(25) +
        `£${s.immediateAmount}`.padEnd(15) +
        `£${s.tiebreakerAmount}`.padEnd(15) +
        `£${s.totalAmount}`.padEnd(15) +
        s.totalPlayers
      );
      totalImmediate += s.immediateAmount;
      totalTiebreaker += s.tiebreakerAmount;
      totalPlayers += s.totalPlayers;
    }

    console.log('-'.repeat(100));
    console.log(
      'TOTALS'.padEnd(25) +
      `£${totalImmediate}`.padEnd(15) +
      `£${totalTiebreaker}`.padEnd(15) +
      `£${totalImmediate + totalTiebreaker}`.padEnd(15) +
      totalPlayers
    );

    // Check for discrepancies
    console.log('\n\n' + '='.repeat(100));
    console.log('⚠️  BUDGET DISCREPANCY CHECK');
    console.log('='.repeat(100));

    let hasDiscrepancies = false;

    for (const s of summary) {
      // Check if tiebreaker amounts might not have been deducted
      if (s.tiebreakerAmount > 0) {
        console.log(`\n${s.teamName}:`);
        console.log(`  Tiebreaker wins: £${s.tiebreakerAmount} (${s.tiebreakerCount} players)`);
        console.log(`  ⚠️  These amounts may not have been deducted from budget`);
        console.log(`  ⚠️  Current spent (£${s.currentSpent}) should include this amount`);
        hasDiscrepancies = true;
      }
    }

    if (!hasDiscrepancies) {
      console.log('\n✅ No tiebreaker wins found - all sales were immediate assignments');
    } else {
      console.log(`\n\n📝 RECOMMENDED ACTION:`);
      console.log(`   Run: node scripts/check-tiebreaker-budget-deductions.js`);
      console.log(`   This will generate SQL to fix the missing deductions`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Get round ID from command line or use default
const roundId = process.argv[2] || 'SSPSLFBR00008';

// Run the script
analyzeBulkRound(roundId)
  .then(() => {
    console.log('\n\n✅ Analysis completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
