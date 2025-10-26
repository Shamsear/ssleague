/**
 * Check team stats in Neon database
 */

const { neon } = require('@neondatabase/serverless');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

async function checkTeamStats() {
  console.log('🔍 Checking team stats in Neon...\n');

  try {
    // Check all teams in teamstats
    const allTeams = await sql`SELECT DISTINCT team_id, team_name FROM teamstats`;
    console.log(`Found ${allTeams.length} unique teams in teamstats:`);
    allTeams.forEach((team, i) => {
      console.log(`  ${i + 1}. ${team.team_name} (ID: ${team.team_id})`);
    });
    console.log('');

    // Check Team Psychoz specifically
    const psychozStats = await sql`
      SELECT * FROM teamstats 
      WHERE team_name ILIKE '%psychoz%'
      ORDER BY season_id DESC
    `;

    console.log(`Team Psychoz stats (${psychozStats.length} seasons):`);
    psychozStats.forEach(stat => {
      console.log(`  Season ${stat.season_id}:`);
      console.log(`    Team ID: ${stat.team_id}`);
      console.log(`    Matches: ${stat.matches_played}, Wins: ${stat.wins}, Draws: ${stat.draws}, Losses: ${stat.losses}`);
      console.log(`    Goals: ${stat.goals_for}-${stat.goals_against}, Points: ${stat.points}, Position: ${stat.position}`);
    });
    console.log('');

    // Check player stats for Team Psychoz
    const psychozPlayers = await sql`
      SELECT DISTINCT player_name FROM realplayerstats 
      WHERE team ILIKE '%psychoz%'
    `;

    console.log(`Team Psychoz players (${psychozPlayers.length} unique):`);
    psychozPlayers.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.player_name}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  process.exit(0);
}

checkTeamStats();
