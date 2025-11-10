require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

async function checkStats() {
  const stats = await sql`
    SELECT player_id, player_name, season_id, tournament_id, matches_played, goals_scored
    FROM realplayerstats
    WHERE player_id IN ('sspslpsl0012', 'sspslpsl0165')
    ORDER BY player_id, season_id, tournament_id
  `;
  
  console.log('Stats for these players:');
  console.log(JSON.stringify(stats, null, 2));
}

checkStats();
