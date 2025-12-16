const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

async function checkData() {
  try {
    // Check matchups with goals entered (regardless of result field)
    const withGoals = await sql`
      SELECT COUNT(*) as count 
      FROM matchups 
      WHERE season_id = 'SSPSLS16' 
        AND (home_goals IS NOT NULL OR away_goals IS NOT NULL)
    `;
    console.log('Matchups with goals (any):', withGoals[0].count);
    
    // Sample matchups with goals
    const sample = await sql`
      SELECT fixture_id, position, home_player_name, away_player_name, home_goals, away_goals, result, result_entered_at
      FROM matchups 
      WHERE season_id = 'SSPSLS16' 
        AND (home_goals IS NOT NULL OR away_goals IS NOT NULL)
      LIMIT 10
    `;
    console.log('\nSample matchups with goals:');
    console.log(JSON.stringify(sample, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkData();
