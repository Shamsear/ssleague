const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

async function checkData() {
  try {
    // Check total matchups
    const total = await sql`SELECT COUNT(*) as count FROM matchups WHERE season_id = 'SSPSLS16'`;
    console.log('Total matchups for SSPSLS16:', total[0].count);
    
    // Check matchups with results
    const withResults = await sql`SELECT COUNT(*) as count FROM matchups WHERE season_id = 'SSPSLS16' AND result IS NOT NULL`;
    console.log('Matchups with results:', withResults[0].count);
    
    // Check matchups with goals
    const withGoals = await sql`SELECT COUNT(*) as count FROM matchups WHERE season_id = 'SSPSLS16' AND (home_goals > 0 OR away_goals > 0)`;
    console.log('Matchups with goals scored:', withGoals[0].count);
    
    // Sample matchup with goals
    const sample = await sql`
      SELECT fixture_id, home_player_name, away_player_name, home_goals, away_goals, result 
      FROM matchups 
      WHERE season_id = 'SSPSLS16' AND result IS NOT NULL
      LIMIT 5
    `;
    console.log('\nSample completed matchups:');
    console.log(JSON.stringify(sample, null, 2));
    
    // Check one player's matches
    const playerMatches = await sql`
      SELECT fixture_id, home_player_id, home_player_name, away_player_id, away_player_name, home_goals, away_goals
      FROM matchups
      WHERE season_id = 'SSPSLS16' 
        AND (home_player_name = 'Vimal' OR away_player_name = 'Vimal')
        AND result IS NOT NULL
      LIMIT 5
    `;
    console.log('\nVimal matches:');
    console.log(JSON.stringify(playerMatches, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkData();
