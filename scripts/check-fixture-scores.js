require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkFixtures() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);
  
  const fixtures = await sql`
    SELECT 
      id,
      home_team_name,
      away_team_name,
      home_score,
      away_score,
      home_penalty_goals,
      away_penalty_goals
    FROM fixtures 
    WHERE season_id = 'SSPSLS16' 
      AND status = 'completed' 
    ORDER BY round_number
  `;
  
  console.log('Fixture ID | Home Team            | Away Team            | Score  | Penalties');
  console.log('-----------|----------------------|----------------------|--------|----------');
  
  fixtures.forEach(f => {
    const id = f.id.slice(-10);
    const home = f.home_team_name.padEnd(20);
    const away = f.away_team_name.padEnd(20);
    const score = `${f.home_score}-${f.away_score}`.padEnd(6);
    const pen = `H:${f.home_penalty_goals||0} A:${f.away_penalty_goals||0}`;
    console.log(`${id} | ${home} | ${away} | ${score} | ${pen}`);
  });
}

checkFixtures().then(() => process.exit(0));
