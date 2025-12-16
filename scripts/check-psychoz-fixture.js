require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkFixture() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);
  
  // Get the fixture
  const fixture = await sql`
    SELECT * FROM fixtures 
    WHERE home_team_name = 'Los Galacticos' 
      AND away_team_name = 'Psychoz'
      AND season_id = 'SSPSLS16'
  `;
  
  console.log('Fixture Details:');
  console.log('================');
  console.log(`Home: ${fixture[0].home_team_name}`);
  console.log(`Away: ${fixture[0].away_team_name}`);
  console.log(`Score: ${fixture[0].home_score}-${fixture[0].away_score}`);
  console.log(`Penalty Goals: Home ${fixture[0].home_penalty_goals || 0}, Away ${fixture[0].away_penalty_goals || 0}`);
  console.log(`Result: ${fixture[0].result}`);
  
  // Get matchups
  const matchups = await sql`
    SELECT * FROM matchups
    WHERE fixture_id = ${fixture[0].id}
    ORDER BY position
  `;
  
  console.log('\nMatchup Results:');
  console.log('================');
  let homeTotal = 0;
  let awayTotal = 0;
  
  matchups.forEach((m, i) => {
    console.log(`Match ${i+1}: ${m.home_goals}-${m.away_goals}`);
    homeTotal += m.home_goals;
    awayTotal += m.away_goals;
  });
  
  console.log(`\nTotal from matchups: ${homeTotal}-${awayTotal}`);
  console.log(`With penalties: ${homeTotal + (fixture[0].home_penalty_goals || 0)}-${awayTotal + (fixture[0].away_penalty_goals || 0)}`);
}

checkFixture().then(() => process.exit(0));
