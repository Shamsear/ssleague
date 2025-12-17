const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

async function findTeam() {
  const sql = neon(process.env.DATABASE_URL);
  
  // Find Round 2 fixtures with "Skill" in the name
  const fixtures = await sql`
    SELECT 
      home_team_id,
      home_team_name,
      away_team_id,
      away_team_name,
      round_number,
      season_id
    FROM fixtures
    WHERE round_number = 2
      AND (LOWER(home_team_name) LIKE '%skill%' OR LOWER(away_team_name) LIKE '%skill%')
  `;
  
  console.log('Round 2 fixtures with "Skill" teams:');
  console.table(fixtures);
}

findTeam();
