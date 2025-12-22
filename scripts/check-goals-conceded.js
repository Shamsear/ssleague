require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkGoalsConceded() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);
  
  const players = await sql`
    SELECT player_name, goals_scored, goals_conceded 
    FROM player_seasons 
    WHERE season_id = 'SSPSLS16' 
    ORDER BY player_name
    LIMIT 10
  `;
  
  console.table(players);
}

checkGoalsConceded();
