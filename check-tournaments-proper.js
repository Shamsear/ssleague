require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const tournamentSql = neon(process.env.NEON_TOURNAMENT_DB_URL);

(async () => {
  try {
    console.log('Checking tournaments in tournament database...\n');
    
    // Get all tournaments
    const tournaments = await tournamentSql`
      SELECT id, season_id, tournament_name, tournament_type, status, is_primary, display_order 
      FROM tournaments 
      ORDER BY season_id DESC, display_order ASC
    `;
    
    console.log('All Tournaments:');
    console.log(JSON.stringify(tournaments, null, 2));
    
    // Group by season
    const bySeason = {};
    tournaments.forEach(t => {
      if (!bySeason[t.season_id]) {
        bySeason[t.season_id] = [];
      }
      bySeason[t.season_id].push(t);
    });
    
    console.log('\n=== Tournaments by Season ===');
    Object.keys(bySeason).forEach(seasonId => {
      console.log(`\nSeason: ${seasonId}`);
      bySeason[seasonId].forEach(t => {
        console.log(`  - ${t.tournament_name} (${t.tournament_type}) - ${t.status} ${t.is_primary ? '⭐ PRIMARY' : ''}`);
      });
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
})();
