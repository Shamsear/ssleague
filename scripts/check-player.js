/**
 * Check specific player in Neon database
 */

const { neon } = require('@neondatabase/serverless');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

async function checkPlayer() {
  const playerId = 'sspslpsl0005';
  
  console.log(`🔍 Checking player ${playerId} in Neon...\n`);

  try {
    // Check player stats
    const stats = await sql`
      SELECT * FROM realplayerstats 
      WHERE player_id = ${playerId}
      ORDER BY season_id DESC
    `;

    console.log(`Found ${stats.length} season(s) for player ${playerId}:`);
    stats.forEach(stat => {
      console.log(`\nSeason ${stat.season_id}:`);
      console.log(`  Player: ${stat.player_name}`);
      console.log(`  Team: ${stat.team} (ID: ${stat.team_id})`);
      console.log(`  Category: ${stat.category}`);
      console.log(`  Matches: ${stat.matches_played}, Goals: ${stat.goals_scored}, Assists: ${stat.assists}`);
      console.log(`  Wins: ${stat.wins}, Draws: ${stat.draws}, Losses: ${stat.losses}`);
      console.log(`  Points: ${stat.points}, Clean Sheets: ${stat.clean_sheets}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  process.exit(0);
}

checkPlayer();
