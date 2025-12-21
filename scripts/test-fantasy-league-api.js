const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.FANTASY_DATABASE_URL || process.env.DATABASE_URL);

async function testAPI() {
  try {
    console.log('🔍 Testing fantasy league API query...\n');

    const leagueId = 'SSPSLFLS16';

    // Simulate the exact API query
    const teams = await sql`
      SELECT 
        ft.team_id,
        ft.team_name,
        ft.owner_name,
        ft.total_points,
        ft.rank,
        ft.draft_submitted,
        ft.supported_team_id,
        ft.supported_team_name,
        COALESCE(ft.passive_points, 0) as passive_points,
        COALESCE(ft.budget_remaining, 0) as budget_remaining,
        COUNT(DISTINCT fs.real_player_id) as player_count
      FROM fantasy_teams ft
      LEFT JOIN fantasy_squad fs ON ft.team_id = fs.team_id
      WHERE ft.league_id = ${leagueId}
      GROUP BY ft.team_id, ft.team_name, ft.owner_name, ft.total_points, ft.rank, ft.draft_submitted, ft.supported_team_id, ft.supported_team_name, ft.passive_points, ft.budget_remaining
      ORDER BY ft.rank ASC NULLS LAST, ft.total_points DESC
    `;

    console.log(`Found ${teams.length} teams:\n`);

    teams.forEach(team => {
      console.log(`${team.team_name}:`);
      console.log(`  Budget: €${team.budget_remaining}M (type: ${typeof team.budget_remaining})`);
      console.log(`  Points: ${team.total_points}`);
      console.log(`  Players: ${team.player_count}`);
      console.log('');
    });

    // Show what the API would return
    console.log('\n📤 API Response Format:');
    const apiFormat = teams.map(team => ({
      id: team.team_id,
      team_name: team.team_name,
      owner_name: team.owner_name,
      total_points: Number(team.total_points) || 0,
      rank: team.rank || null,
      player_count: Number(team.player_count) || 0,
      budget_remaining: Number(team.budget_remaining) || 0,
    }));

    console.log(JSON.stringify(apiFormat.slice(0, 2), null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testAPI();
