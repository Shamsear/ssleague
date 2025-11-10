require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

async function checkId() {
  const stats = await sql`
    SELECT id, player_id, player_name, season_id, tournament_id
    FROM realplayerstats
    WHERE season_id = 'SSPSLS13' AND tournament_id = 'historical'
  `;
  
  console.log('Stats with id column:');
  console.log(JSON.stringify(stats, null, 2));
}

checkId();
