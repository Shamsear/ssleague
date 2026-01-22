require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    // Get recent seasons
    const seasons = await sql`
      SELECT id, season_name, is_active 
      FROM seasons 
      ORDER BY created_at DESC 
      LIMIT 3
    `;
    
    console.log('Recent Seasons:');
    console.log(JSON.stringify(seasons, null, 2));
    
    // Get active season
    const activeSeason = seasons.find(s => s.is_active);
    
    if (activeSeason) {
      console.log('\n=== Active Season:', activeSeason.season_name, '===\n');
      
      // Get tournaments for active season
      const tournaments = await sql`
        SELECT id, tournament_name, tournament_type, status, is_primary, display_order 
        FROM tournaments 
        WHERE season_id = ${activeSeason.id} 
        ORDER BY display_order ASC
      `;
      
      console.log('Tournaments for active season:');
      console.log(JSON.stringify(tournaments, null, 2));
      
      // Check team_seasons for a sample team
      const teamSeasons = await sql`
        SELECT ts.id, ts.user_id, ts.season_id, ts.status, u.email
        FROM team_seasons ts
        LEFT JOIN users u ON u.uid = ts.user_id
        WHERE ts.season_id = ${activeSeason.id}
        AND ts.status = 'registered'
        LIMIT 5
      `;
      
      console.log('\nSample registered teams:');
      console.log(JSON.stringify(teamSeasons, null, 2));
    } else {
      console.log('\nNo active season found!');
    }
  } catch (error) {
    console.error('Error:', error);
  }
})();
