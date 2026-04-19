/**
 * Generate a combined budget fix report for multiple bulk rounds
 * Creates a single markdown file with all the information
 */

const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

async function generateCombinedReport(roundIds) {
  console.log(`📊 Generating combined budget fix report for rounds: ${roundIds.join(', ')}...\n`);

  try {
    // Store all data by team
    const teamDataMap = new Map();
    const roundInfoMap = new Map();

    // Process each round
    for (const roundId of roundIds) {
      console.log(`\n🔍 Processing round ${roundId}...`);

      // Get round info
      const roundInfo = await sql`
        SELECT id, round_number, base_price, season_id, status
        FROM rounds
        WHERE id = ${roundId}
      `;

      if (roundInfo.length === 0) {
        console.log(`⚠️  Round ${roundId} not found, skipping...`);
        continue;
      }

      const round = roundInfo[0];
      roundInfoMap.set(roundId, round);

      // Get all sold players
      const immediateSales = await sql`
        SELECT 
          rp.player_id,
          rp.player_name,
          rp.position,
          rp.winning_team_id,
          rp.winning_bid,
          'immediate' as type,
          ${roundId} as round_id
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
          'tiebreaker' as type,
          ${roundId} as round_id
        FROM bulk_tiebreakers bt
        WHERE bt.bulk_round_id = ${roundId}
        AND bt.status = 'resolved'
      `;

      const allSales = [...immediateSales, ...tiebreakerWins];
      console.log(`   Found ${immediateSales.length} immediate + ${tiebreakerWins.length} tiebreaker = ${allSales.length} total sales`);

      // Group by team
      for (const sale of allSales) {
        const teamId = sale.winning_team_id;
        if (!teamDataMap.has(teamId)) {
          teamDataMap.set(teamId, {
            players: [],
            total: 0,
            byRound: new Map()
          });
        }
        const teamData = teamDataMap.get(teamId);
        
        // Add to overall
        teamData.players.push({
          name: sale.player_name,
          position: sale.position,
          amount: parseFloat(sale.winning_bid),
          type: sale.type,
          roundId: sale.round_id
        });
        teamData.total += parseFloat(sale.winning_bid);

        // Add to round-specific
        if (!teamData.byRound.has(roundId)) {
          teamData.byRound.set(roundId, { players: [], total: 0 });
        }
        const roundData = teamData.byRound.get(roundId);
        roundData.players.push({
          name: sale.player_name,
          position: sale.position,
          amount: parseFloat(sale.winning_bid),
          type: sale.type
        });
        roundData.total += parseFloat(sale.winning_bid);
      }
    }

    // Get team info for all teams
    const teamIds = Array.from(teamDataMap.keys());
    if (teamIds.length === 0) {
      console.log('❌ No teams found with sales');
      return;
    }

    // Get season from first round
    const firstRound = Array.from(roundInfoMap.values())[0];
    const seasonId = firstRound.season_id;

    const teams = await sql`
      SELECT 
        id,
        name,
        football_budget,
        football_spent,
        firebase_uid
      FROM teams
      WHERE id = ANY(${teamIds})
      AND season_id = ${seasonId}
      ORDER BY name
    `;

    const teamInfoMap = new Map(teams.map(t => [t.id, t]));

    // Generate markdown report
    let report = `# Combined Budget Fix Report\n\n`;
    report += `**Rounds:** ${roundIds.join(', ')}\n`;
    report += `**Season:** ${seasonId}\n\n`;
    report += `**Generated:** ${new Date().toLocaleString()}\n\n`;
    report += `---\n\n`;

    // Round summaries
    report += `## Round Summaries\n\n`;
    for (const [roundId, roundInfo] of roundInfoMap) {
      const roundTeams = new Set();
      let roundTotal = 0;
      let roundImmediate = 0;
      let roundTiebreaker = 0;

      for (const [teamId, teamData] of teamDataMap) {
        if (teamData.byRound.has(roundId)) {
          roundTeams.add(teamId);
          const roundData = teamData.byRound.get(roundId);
          roundTotal += roundData.total;
          for (const player of roundData.players) {
            if (player.type === 'immediate') roundImmediate++;
            else roundTiebreaker++;
          }
        }
      }

      report += `### ${roundId} - Round #${roundInfo.round_number}\n`;
      report += `- Base Price: £${roundInfo.base_price}\n`;
      report += `- Teams affected: ${roundTeams.size}\n`;
      report += `- Immediate assignments: ${roundImmediate}\n`;
      report += `- Tiebreaker wins: ${roundTiebreaker}\n`;
      report += `- Total to deduct: £${roundTotal}\n\n`;
    }

    report += `---\n\n`;

    // Overall summary
    report += `## Overall Summary\n\n`;
    report += `- **Total teams affected:** ${teams.length}\n`;
    report += `- **Total players sold:** ${Array.from(teamDataMap.values()).reduce((sum, t) => sum + t.players.length, 0)}\n`;
    report += `- **Grand total to deduct:** £${Array.from(teamDataMap.values()).reduce((sum, t) => sum + t.total, 0)}\n\n`;
    report += `---\n\n`;

    let grandTotal = 0;

    // Process each team
    for (const team of teams) {
      const teamData = teamDataMap.get(team.id);
      if (!teamData) continue;

      grandTotal += teamData.total;

      report += `## ${team.name}\n\n`;
      report += `**Team ID:** ${team.id}\n\n`;

      // Current state
      report += `### Current State (Neon)\n\n`;
      report += `| Field | Value |\n`;
      report += `|-------|-------|\n`;
      report += `| Budget | £${team.football_budget} |\n`;
      report += `| Spent | £${team.football_spent} |\n\n`;

      // Players acquired by round
      report += `### Players Acquired (${teamData.players.length} total across ${teamData.byRound.size} rounds)\n\n`;

      for (const [roundId, roundData] of teamData.byRound) {
        const roundInfo = roundInfoMap.get(roundId);
        report += `#### ${roundId} - Round #${roundInfo.round_number}\n\n`;
        report += `| Type | Player | Position | Amount |\n`;
        report += `|------|--------|----------|--------|\n`;

        let immediateTotal = 0;
        let tiebreakerTotal = 0;

        for (const player of roundData.players) {
          const typeIcon = player.type === 'immediate' ? '✅' : '🏆';
          report += `| ${typeIcon} ${player.type} | ${player.name} | ${player.position} | £${player.amount} |\n`;
          
          if (player.type === 'immediate') {
            immediateTotal += player.amount;
          } else {
            tiebreakerTotal += player.amount;
          }
        }

        report += `\n**Round Subtotals:**\n`;
        report += `- Immediate: £${immediateTotal}\n`;
        report += `- Tiebreaker: £${tiebreakerTotal}\n`;
        report += `- **Round Total: £${roundData.total}**\n\n`;
      }

      // Overall team total
      report += `**Team Grand Total: £${teamData.total}**\n\n`;

      // After deduction
      const newBudget = parseFloat(team.football_budget) - teamData.total;
      const newSpent = parseFloat(team.football_spent) + teamData.total;

      report += `### After Deduction\n\n`;
      report += `| Field | Current | Change | New Value |\n`;
      report += `|-------|---------|--------|----------|\n`;
      report += `| Budget | £${team.football_budget} | -£${teamData.total} | £${newBudget.toFixed(2)} |\n`;
      report += `| Spent | £${team.football_spent} | +£${teamData.total} | £${newSpent.toFixed(2)} |\n\n`;

      // SQL to execute
      report += `### SQL to Execute (Neon)\n\n`;
      report += `\`\`\`sql\n`;
      report += `UPDATE teams\n`;
      report += `SET \n`;
      report += `  football_budget = football_budget - ${teamData.total},\n`;
      report += `  football_spent = football_spent + ${teamData.total},\n`;
      report += `  updated_at = NOW()\n`;
      report += `WHERE id = '${team.id}'\n`;
      report += `AND season_id = '${seasonId}';\n`;
      report += `\`\`\`\n\n`;

      // Firebase update
      report += `### Firebase Update\n\n`;
      report += `**Document:** \`team_seasons/${team.id}_${seasonId}\`\n\n`;
      report += `**Fields to update:**\n`;
      report += `- \`football_budget\`: DECREASE by £${teamData.total}\n`;
      report += `- \`football_spent\`: INCREASE by £${teamData.total}\n\n`;

      report += `---\n\n`;
    }

    // Final summary table
    report += `## Final Summary Table\n\n`;
    report += `| Team | Total Players | Total Amount |\n`;
    report += `|------|--------------|-------------|\n`;

    for (const team of teams) {
      const teamData = teamDataMap.get(team.id);
      if (!teamData) continue;
      report += `| ${team.name} | ${teamData.players.length} | £${teamData.total} |\n`;
    }

    report += `\n**GRAND TOTAL: £${grandTotal}**\n\n`;

    report += `---\n\n`;
    report += `## Instructions\n\n`;
    report += `1. Review each team's data carefully\n`;
    report += `2. For each team you want to fix:\n`;
    report += `   - Copy the SQL statement and run it in your Neon console\n`;
    report += `   - Update the Firebase document using the budget sync page or Firebase console\n`;
    report += `3. Verify the changes after applying\n\n`;

    report += `**Budget Sync Page:** http://localhost:3000/dashboard/committee/reports/budget-sync\n\n`;

    // Save report
    const filename = `BUDGET_FIX_REPORT_COMBINED_${Date.now()}.md`;
    fs.writeFileSync(filename, report);

    console.log(`\n✅ Combined report generated: ${filename}\n`);
    console.log(`📄 You can now review the report and apply fixes manually.\n`);
    console.log(`Summary:`);
    console.log(`- Rounds: ${roundIds.length}`);
    console.log(`- Teams: ${teams.length}`);
    console.log(`- Total to deduct: £${grandTotal}`);
    console.log(`\nOpen the file to see detailed information for each team.`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Get round IDs from command line or use defaults
const roundIds = process.argv.slice(2);
if (roundIds.length === 0) {
  roundIds.push('SSPSLFBR00008', 'SSPSLFBR00009', 'SSPSLFBR00010');
}

// Run the script
generateCombinedReport(roundIds)
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
