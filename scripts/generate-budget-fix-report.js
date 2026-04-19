/**
 * Generate a detailed report of budget fixes needed for bulk round
 * Creates a markdown file with all the information
 */

const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

async function generateReport(roundId = 'SSPSLFBR00008') {
  console.log(`📊 Generating budget fix report for bulk round ${roundId}...\n`);

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

    // Get all sold players
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
      AND rp.bid_count = 1
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
      ORDER BY name
    `;

    const teamInfoMap = new Map(teams.map(t => [t.id, t]));

    // Generate markdown report
    let report = `# Budget Fix Report for Bulk Round ${roundId}\n\n`;
    report += `**Round:** #${round.round_number} | **Base Price:** £${round.base_price} | **Season:** ${round.season_id}\n\n`;
    report += `**Generated:** ${new Date().toLocaleString()}\n\n`;
    report += `---\n\n`;

    report += `## Summary\n\n`;
    report += `- **Teams affected:** ${teams.length}\n`;
    report += `- **Total players sold:** ${allSales.length}\n`;
    report += `- **Immediate assignments:** ${immediateSales.length}\n`;
    report += `- **Tiebreaker wins:** ${tiebreakerWins.length}\n\n`;
    report += `---\n\n`;

    let totalToDeduct = 0;

    // Process each team
    for (const team of teams) {
      const sales = teamSales.get(team.id);
      if (!sales) continue;

      totalToDeduct += sales.total;

      report += `## ${team.name}\n\n`;
      report += `**Team ID:** ${team.id}\n\n`;

      // Current state
      report += `### Current State (Neon)\n\n`;
      report += `| Field | Value |\n`;
      report += `|-------|-------|\n`;
      report += `| Budget | £${team.football_budget} |\n`;
      report += `| Spent | £${team.football_spent} |\n\n`;

      // Players acquired
      report += `### Players Acquired (${sales.players.length} total)\n\n`;
      report += `| Type | Player | Position | Amount |\n`;
      report += `|------|--------|----------|--------|\n`;

      let immediateTotal = 0;
      let tiebreakerTotal = 0;

      for (const player of sales.players) {
        const typeIcon = player.type === 'immediate' ? '✅' : '🏆';
        report += `| ${typeIcon} ${player.type} | ${player.name} | ${player.position} | £${player.amount} |\n`;
        
        if (player.type === 'immediate') {
          immediateTotal += player.amount;
        } else {
          tiebreakerTotal += player.amount;
        }
      }

      report += `\n**Subtotals:**\n`;
      report += `- Immediate: £${immediateTotal}\n`;
      report += `- Tiebreaker: £${tiebreakerTotal}\n`;
      report += `- **TOTAL: £${sales.total}**\n\n`;

      // After deduction
      const newBudget = parseFloat(team.football_budget) - sales.total;
      const newSpent = parseFloat(team.football_spent) + sales.total;

      report += `### After Deduction\n\n`;
      report += `| Field | Current | Change | New Value |\n`;
      report += `|-------|---------|--------|----------|\n`;
      report += `| Budget | £${team.football_budget} | -£${sales.total} | £${newBudget.toFixed(2)} |\n`;
      report += `| Spent | £${team.football_spent} | +£${sales.total} | £${newSpent.toFixed(2)} |\n\n`;

      // SQL to execute
      report += `### SQL to Execute (Neon)\n\n`;
      report += `\`\`\`sql\n`;
      report += `UPDATE teams\n`;
      report += `SET \n`;
      report += `  football_budget = football_budget - ${sales.total},\n`;
      report += `  football_spent = football_spent + ${sales.total},\n`;
      report += `  updated_at = NOW()\n`;
      report += `WHERE id = '${team.id}'\n`;
      report += `AND season_id = '${round.season_id}';\n`;
      report += `\`\`\`\n\n`;

      // Firebase update
      report += `### Firebase Update\n\n`;
      report += `**Document:** \`team_seasons/${team.id}_${round.season_id}\`\n\n`;
      report += `**Fields to update:**\n`;
      report += `- \`football_budget\`: DECREASE by £${sales.total}\n`;
      report += `- \`football_spent\`: INCREASE by £${sales.total}\n\n`;

      report += `---\n\n`;
    }

    // Overall summary
    report += `## Overall Summary\n\n`;
    report += `| Team | Players | Total Amount |\n`;
    report += `|------|---------|-------------|\n`;

    for (const team of teams) {
      const sales = teamSales.get(team.id);
      if (!sales) continue;
      report += `| ${team.name} | ${sales.players.length} | £${sales.total} |\n`;
    }

    report += `\n**GRAND TOTAL: £${totalToDeduct}**\n\n`;

    report += `---\n\n`;
    report += `## Instructions\n\n`;
    report += `1. Review each team's data carefully\n`;
    report += `2. For each team you want to fix:\n`;
    report += `   - Copy the SQL statement and run it in your Neon console\n`;
    report += `   - Update the Firebase document using the budget sync page or Firebase console\n`;
    report += `3. Verify the changes after applying\n\n`;

    report += `**Budget Sync Page:** http://localhost:3000/dashboard/committee/reports/budget-sync\n\n`;

    // Save report
    const filename = `BUDGET_FIX_REPORT_${roundId}_${Date.now()}.md`;
    fs.writeFileSync(filename, report);

    console.log(`✅ Report generated: ${filename}\n`);
    console.log(`📄 You can now review the report and apply fixes manually.\n`);
    console.log(`Summary:`);
    console.log(`- Teams: ${teams.length}`);
    console.log(`- Total to deduct: £${totalToDeduct}`);
    console.log(`\nOpen the file to see detailed information for each team.`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Get round ID from command line or use default
const roundId = process.argv[2] || 'SSPSLFBR00008';

// Run the script
generateReport(roundId)
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
