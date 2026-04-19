const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_AUCTION_DB_URL);

(async () => {
  try {
    console.log('=== Checking footballplayers table ===\n');
    
    // Check footballplayers table structure and data
    const players = await sql`
      SELECT team_id, season_id, COUNT(*) as count
      FROM footballplayers
      WHERE season_id = 'SSPSLS17'
      GROUP BY team_id, season_id
      ORDER BY team_id
      LIMIT 20
    `;
    
    console.log('Players by team:');
    players.forEach(p => {
      console.log(`  ${p.team_id}: ${p.count} players`);
    });
    
    // Check if there are any players at all
    const totalPlayers = await sql`
      SELECT COUNT(*) as total
      FROM footballplayers
      WHERE season_id = 'SSPSLS17'
    `;
    
    console.log(`\nTotal players in SSPSLS17: ${totalPlayers[0].total}`);
    
    // Check a specific team
    const manchesterUnited = await sql`
      SELECT COUNT(*) as count
      FROM footballplayers
      WHERE team_id = 'manchester-united'
      AND season_id = 'SSPSLS17'
    `;
    
    console.log(`Manchester United players: ${manchesterUnited[0].count}`);
    
    // Check what the API query would return
    console.log('\n=== Simulating API Query ===\n');
    
    const teamIds = ['manchester-united', 'real-madrid', 'barcelona'];
    const squadSizes = await sql`
      SELECT 
        team_id,
        COUNT(*) as squad_size
      FROM footballplayers
      WHERE team_id = ANY(${teamIds})
      AND season_id = 'SSPSLS17'
      GROUP BY team_id
    `;
    
    console.log('Squad sizes for sample teams:');
    squadSizes.forEach(s => {
      console.log(`  ${s.team_id}: ${s.squad_size} players`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
  }
})();
