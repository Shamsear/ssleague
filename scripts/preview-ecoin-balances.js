/**
 * Football Budget Preview - Neon Database
 * 
 * This script shows football_budget (ECoin) balances from the Neon auction database.
 * 
 * PREVIEW ONLY - No changes will be made to any database
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function previewFootballBudgets() {
    console.log('🔍 Football Budget Preview - Neon Database\n');
    console.log('='.repeat(80));
    console.log('📋 PREVIEW MODE - No changes will be made');
    console.log('='.repeat(80));
    console.log('');

    try {
        // Get Neon database connection
        const auctionDbUrl = process.env.NEON_AUCTION_DB_URL;
        if (!auctionDbUrl) {
            console.error('❌ Error: NEON_AUCTION_DB_URL not found in .env.local');
            console.error('   Please add NEON_AUCTION_DB_URL to your .env.local file');
            process.exit(1);
        }

        const sql = neon(auctionDbUrl);

        console.log('📊 Fetching teams from Neon (Auction DB)...\n');

        // Fetch all teams from Neon with budgets
        const teams = await sql`
      SELECT 
        id,
        name,
        season_id,
        football_budget,
        football_spent,
        football_players_count,
        updated_at
      FROM teams
      ORDER BY name
    `;

        console.log(`✅ Found ${teams.length} teams in Neon\n`);

        console.log('='.repeat(80));
        console.log('📊 TEAM BUDGETS');
        console.log('='.repeat(80));
        console.log('');

        // Calculate totals
        let totalBudget = 0;
        let totalSpent = 0;
        let totalRemaining = 0;

        // Group by season
        const teamsBySeason = {};
        teams.forEach(team => {
            const season = team.season_id || 'Unknown';
            if (!teamsBySeason[season]) {
                teamsBySeason[season] = [];
            }
            teamsBySeason[season].push(team);

            const budget = parseFloat(team.football_budget) || 0;
            const spent = parseFloat(team.football_spent) || 0;
            totalBudget += budget;
            totalSpent += spent;
            totalRemaining += budget;
        });

        // Display teams grouped by season
        Object.keys(teamsBySeason).sort().forEach(season => {
            console.log(`📅 Season: ${season}`);
            console.log('-'.repeat(80));

            const seasonTeams = teamsBySeason[season];
            let seasonBudget = 0;
            let seasonSpent = 0;

            seasonTeams.forEach(team => {
                const budget = parseFloat(team.football_budget) || 0;
                const spent = parseFloat(team.football_spent) || 0;
                const remaining = budget;
                const players = team.football_players_count || 0;

                seasonBudget += budget;
                seasonSpent += spent;

                console.log(`   ${team.name.padEnd(30)} Budget: ${budget.toFixed(2).padStart(10)} | Spent: ${spent.toFixed(2).padStart(10)} | Players: ${players.toString().padStart(2)}`);
            });

            console.log('-'.repeat(80));
            console.log(`   Season Total (${seasonTeams.length} teams)`.padEnd(30) + ` Budget: ${seasonBudget.toFixed(2).padStart(10)} | Spent: ${seasonSpent.toFixed(2).padStart(10)}`);
            console.log('');
        });

        // Overall summary
        console.log('='.repeat(80));
        console.log('📊 OVERALL SUMMARY');
        console.log('='.repeat(80));
        console.log(`   Total Teams:                  ${teams.length}`);
        console.log(`   Total Budget Remaining:       ${totalBudget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        console.log(`   Total Spent:                  ${totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        console.log(`   Average Budget per Team:      ${(totalBudget / teams.length).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        console.log(`   Average Spent per Team:       ${(totalSpent / teams.length).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        console.log('');

        // Find teams with low budget
        const lowBudgetTeams = teams.filter(t => parseFloat(t.football_budget) < 1000);
        if (lowBudgetTeams.length > 0) {
            console.log('⚠️  TEAMS WITH LOW BUDGET (< 1000)');
            console.log('-'.repeat(80));
            console.log(`   Found ${lowBudgetTeams.length} teams with low budget:\n`);
            lowBudgetTeams.forEach(team => {
                const budget = parseFloat(team.football_budget) || 0;
                console.log(`   ${team.name.padEnd(35)} Budget: ${budget.toFixed(2).padStart(10)}`);
            });
            console.log('');
        }

        // Find teams with zero budget
        const zeroBudgetTeams = teams.filter(t => parseFloat(t.football_budget) === 0);
        if (zeroBudgetTeams.length > 0) {
            console.log('🚨 TEAMS WITH ZERO BUDGET');
            console.log('-'.repeat(80));
            console.log(`   Found ${zeroBudgetTeams.length} teams with zero budget:\n`);
            zeroBudgetTeams.forEach(team => {
                console.log(`   ${team.name.padEnd(35)} (${team.id})`);
            });
            console.log('');
        }

        // Find teams with highest budget (top 10)
        const sortedByBudget = [...teams].sort((a, b) => parseFloat(b.football_budget || 0) - parseFloat(a.football_budget || 0));
        console.log('💰 TOP 10 TEAMS BY REMAINING BUDGET');
        console.log('-'.repeat(80));
        sortedByBudget.slice(0, 10).forEach((team, index) => {
            const budget = parseFloat(team.football_budget) || 0;
            console.log(`   ${(index + 1).toString().padStart(2)}. ${team.name.padEnd(32)} Budget: ${budget.toFixed(2).padStart(10)}`);
        });
        console.log('');

        // Find teams with highest spending (top 10)
        const sortedBySpent = [...teams].sort((a, b) => parseFloat(b.football_spent || 0) - parseFloat(a.football_spent || 0));
        console.log('💸 TOP 10 TEAMS BY TOTAL SPENDING');
        console.log('-'.repeat(80));
        sortedBySpent.slice(0, 10).forEach((team, index) => {
            const spent = parseFloat(team.football_spent) || 0;
            console.log(`   ${(index + 1).toString().padStart(2)}. ${team.name.padEnd(32)} Spent: ${spent.toFixed(2).padStart(10)}`);
        });
        console.log('');

        // Budget efficiency (teams with most players per budget spent)
        const teamsWithPlayers = teams.filter(t => t.football_players_count > 0);
        const sortedByEfficiency = [...teamsWithPlayers].sort((a, b) => {
            const effA = parseFloat(a.football_spent) / a.football_players_count;
            const effB = parseFloat(b.football_spent) / b.football_players_count;
            return effA - effB;
        });

        console.log('📊 MOST EFFICIENT TEAMS (Lowest Avg Cost per Player)');
        console.log('-'.repeat(80));
        sortedByEfficiency.slice(0, 10).forEach((team, index) => {
            const spent = parseFloat(team.football_spent) || 0;
            const avgCost = spent / team.football_players_count;
            console.log(`   ${(index + 1).toString().padStart(2)}. ${team.name.padEnd(25)} ${team.football_players_count} players @ ${avgCost.toFixed(2).padStart(8)} avg`);
        });
        console.log('');

        console.log('='.repeat(80));
        console.log('✅ Preview complete - No changes were made');
        console.log('='.repeat(80));

        process.exit(0);

    } catch (error) {
        console.error('\n❌ Error during preview:');
        console.error(error);
        console.error('\nDetails:', error.message);

        if (error.message.includes('relation "teams" does not exist')) {
            console.error('\n💡 Tip: Make sure you are connected to the AUCTION database (NEON_AUCTION_DB_URL)');
        }

        process.exit(1);
    }
}

// Run the preview
previewFootballBudgets().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
