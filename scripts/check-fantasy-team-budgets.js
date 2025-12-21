const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.FANTASY_DATABASE_URL || process.env.DATABASE_URL);

async function checkBudgets() {
  try {
    console.log('🔍 Checking fantasy team budgets...\n');

    const teams = await sql`
      SELECT 
        team_id,
        team_name,
        owner_name,
        budget_remaining,
        total_points,
        created_at
      FROM fantasy_teams
      WHERE league_id = 'SSPSLFLS16'
      ORDER BY team_name
    `;

    console.log(`Found ${teams.length} teams:\n`);

    teams.forEach(team => {
      console.log(`Team: ${team.team_name}`);
      console.log(`  Owner: ${team.owner_name}`);
      console.log(`  Budget Remaining: €${team.budget_remaining}M`);
      console.log(`  Total Points: ${team.total_points}`);
      console.log(`  Created: ${team.created_at}`);
      console.log('');
    });

    // Check if budget_remaining column exists and has data
    const columnCheck = await sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'fantasy_teams'
        AND column_name = 'budget_remaining'
    `;

    console.log('\n📊 Column Info:');
    console.log(columnCheck);

    // Get league budget settings
    const league = await sql`
      SELECT league_id, budget_per_team
      FROM fantasy_leagues
      WHERE league_id = 'SSPSLFLS16'
    `;

    console.log('\n💰 League Budget Settings:');
    console.log(`Budget per team: €${league[0]?.budget_per_team}M`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkBudgets();
