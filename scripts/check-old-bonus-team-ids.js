const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);
const tournamentDb = neon(process.env.NEON_TOURNAMENT_DB_URL);

async function check() {
  // Check what was in old records (before we deleted them)
  // Let's look at what format the fixture team IDs use
  const fixtures = await tournamentDb`
    SELECT id, home_team_id, away_team_id, home_team_name, away_team_name
    FROM fixtures
    WHERE season_id = 'SSPSLS16'
    LIMIT 3
  `;
  
  console.log('Fixture Team IDs:');
  fixtures.forEach(f => {
    console.log(`  ${f.home_team_name}: ${f.home_team_id}`);
    console.log(`  ${f.away_team_name}: ${f.away_team_id}`);
  });
  
  console.log('\nFantasy Team supported_team_id:');
  const teams = await fantasyDb`
    SELECT team_name, supported_team_id, supported_team_name
    FROM fantasy_teams
    WHERE supported_team_id IS NOT NULL
    LIMIT 3
  `;
  
  teams.forEach(t => {
    console.log(`  ${t.team_name} → ${t.supported_team_name}: ${t.supported_team_id}`);
  });
}

check().then(() => process.exit(0));
