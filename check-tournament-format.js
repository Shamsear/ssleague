require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const tournamentSql = neon(process.env.NEON_TOURNAMENT_DB_URL);

(async () => {
  try {
    console.log('Checking tournament formats...\n');
    
    // Get all tournaments for Season 16
    const tournaments = await tournamentSql`
      SELECT 
        id, 
        tournament_name, 
        tournament_type,
        has_league_stage,
        has_group_stage,
        has_knockout_stage,
        is_pure_knockout,
        number_of_groups,
        teams_per_group,
        teams_advancing_per_group
      FROM tournaments 
      WHERE season_id = 'SSPSLS16'
      ORDER BY display_order ASC
    `;
    
    console.log('Season 16 Tournaments:');
    tournaments.forEach(t => {
      console.log(`\n${t.tournament_name} (${t.id})`);
      console.log(`  Type: ${t.tournament_type}`);
      console.log(`  Has League Stage: ${t.has_league_stage}`);
      console.log(`  Has Group Stage: ${t.has_group_stage}`);
      console.log(`  Has Knockout Stage: ${t.has_knockout_stage}`);
      console.log(`  Is Pure Knockout: ${t.is_pure_knockout}`);
      if (t.has_group_stage) {
        console.log(`  Groups: ${t.number_of_groups}, Teams per group: ${t.teams_per_group}, Advancing: ${t.teams_advancing_per_group}`);
      }
    });
    
    // Check if there are any fixtures for these tournaments
    console.log('\n\n=== Checking Fixtures ===');
    for (const tournament of tournaments) {
      const fixtures = await tournamentSql`
        SELECT COUNT(*) as count, status
        FROM fixtures
        WHERE tournament_id = ${tournament.id}
        GROUP BY status
      `;
      
      console.log(`\n${tournament.tournament_name}:`);
      if (fixtures.length === 0) {
        console.log('  No fixtures found');
      } else {
        fixtures.forEach(f => {
          console.log(`  ${f.status}: ${f.count} fixtures`);
        });
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
})();
