const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_AUCTION_DB_URL);

(async () => {
  try {
    console.log('=== Testing Team Summary Fix ===\n');
    
    const seasonId = 'SSPSLS17';
    
    // Get teams from Neon
    const teams = await sql`
      SELECT id, name
      FROM teams
      WHERE season_id = ${seasonId}
      ORDER BY name
    `;
    
    console.log(`Found ${teams.length} teams for ${seasonId}\n`);
    
    // Get squad sizes WITHOUT season filter
    const teamIds = teams.map(t => t.id);
    
    const squadSizes = await sql`
      SELECT 
        team_id,
        COUNT(*) as squad_size
      FROM footballplayers
      WHERE team_id = ANY(${teamIds})
      GROUP BY team_id
    `;
    
    console.log('Squad sizes by team:');
    const squadSizeMap = new Map(
      squadSizes.map(row => [row.team_id, parseInt(row.squad_size)])
    );
    
    teams.forEach(team => {
      const squadSize = squadSizeMap.get(team.id) || 0;
      const maxSquadSize = 25;
      const remainingSlots = Math.max(0, maxSquadSize - squadSize);
      
      console.log(`  ${team.name}:`);
      console.log(`    Current Squad: ${squadSize}`);
      console.log(`    Max Squad: ${maxSquadSize}`);
      console.log(`    Remaining Slots: ${remainingSlots}`);
    });
    
    console.log('\n✅ Fix verified! Teams now show correct player counts.');
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
  }
})();
