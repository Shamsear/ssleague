require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const tournamentSql = neon(process.env.NEON_TOURNAMENT_DB_URL);

(async () => {
  try {
    console.log('Checking Champions League fixtures...\n');
    
    const fixtures = await tournamentSql`
      SELECT 
        id,
        home_team_name,
        away_team_name,
        home_score,
        away_score,
        status,
        group_name,
        knockout_round,
        scheduled_date
      FROM fixtures
      WHERE tournament_id = 'SSPSLS16CH'
      ORDER BY scheduled_date ASC
    `;
    
    console.log(`Total fixtures: ${fixtures.length}\n`);
    
    fixtures.forEach(f => {
      console.log(`${f.home_team_name} vs ${f.away_team_name}`);
      console.log(`  Status: ${f.status}`);
      console.log(`  Group: ${f.group_name || 'N/A'}`);
      console.log(`  Knockout Round: ${f.knockout_round || 'N/A'}`);
      if (f.status === 'completed') {
        console.log(`  Score: ${f.home_score} - ${f.away_score}`);
      }
      console.log(`  Date: ${f.scheduled_date}`);
      console.log('');
    });
    
    console.log('\n=== Pro League fixtures ===\n');
    
    const proLeagueFixtures = await tournamentSql`
      SELECT 
        id,
        home_team_name,
        away_team_name,
        home_score,
        away_score,
        status,
        group_name,
        knockout_round,
        scheduled_date
      FROM fixtures
      WHERE tournament_id = 'SSPSLS16EL'
      ORDER BY scheduled_date ASC
    `;
    
    console.log(`Total fixtures: ${proLeagueFixtures.length}\n`);
    
    proLeagueFixtures.forEach(f => {
      console.log(`${f.home_team_name} vs ${f.away_team_name}`);
      console.log(`  Status: ${f.status}`);
      console.log(`  Group: ${f.group_name || 'N/A'}`);
      if (f.status === 'completed') {
        console.log(`  Score: ${f.home_score} - ${f.away_score}`);
      }
      console.log(`  Date: ${f.scheduled_date}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
})();
