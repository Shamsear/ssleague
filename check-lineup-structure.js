require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkLineupStructure() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);
  
  // Get a fixture with a submitted lineup
  const fixtures = await sql`
    SELECT 
      id,
      home_team_name,
      away_team_name,
      home_lineup,
      away_lineup
    FROM fixtures 
    WHERE home_lineup IS NOT NULL 
    LIMIT 1
  `;

  if (fixtures.length > 0) {
    const fixture = fixtures[0];
    console.log('\n=== Fixture ID:', fixture.id);
    console.log('\n=== Home Team:', fixture.home_team_name);
    console.log('Home Lineup Type:', typeof fixture.home_lineup);
    console.log('Home Lineup:', JSON.stringify(fixture.home_lineup, null, 2));
    
    if (fixture.away_lineup) {
      console.log('\n=== Away Team:', fixture.away_team_name);
      console.log('Away Lineup Type:', typeof fixture.away_lineup);
      console.log('Away Lineup:', JSON.stringify(fixture.away_lineup, null, 2));
    }
  } else {
    console.log('No fixtures with lineups found');
  }
}

checkLineupStructure().catch(console.error);
