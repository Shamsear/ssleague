require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkSeasons() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

  const seasons = await sql`
    SELECT DISTINCT season_id, COUNT(*) as player_count
    FROM player_seasons
    GROUP BY season_id
    ORDER BY season_id DESC
  `;

  console.log('Available seasons:');
  seasons.forEach(s => {
    console.log(`  ${s.season_id}: ${s.player_count} players`);
  });
}

checkSeasons();
