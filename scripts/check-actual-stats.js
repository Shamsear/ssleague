require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkStats() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);
  
  const players = await sql`
    SELECT 
      player_name,
      team,
      matches_played,
      goals_scored,
      goals_conceded,
      wins,
      draws,
      losses,
      clean_sheets,
      motm_awards
    FROM player_seasons 
    WHERE season_id = 'SSPSLS16' 
    ORDER BY matches_played DESC 
    LIMIT 10
  `;
  
  console.log('Top 10 Players by Matches Played:\n');
  players.forEach(p => {
    console.log(`${p.player_name} (${p.team || 'No Team'})`);
    console.log(`  Matches: ${p.matches_played}`);
    console.log(`  Goals: ${p.goals_scored} scored, ${p.goals_conceded} conceded`);
    console.log(`  Record: ${p.wins}W - ${p.draws}D - ${p.losses}L`);
    console.log(`  Clean Sheets: ${p.clean_sheets}`);
    console.log(`  MOTM: ${p.motm_awards}\n`);
  });
}

checkStats().catch(console.error);
