const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_AUCTION_DB_URL);

(async () => {
  try {
    console.log('=== Testing Dynamic Slots in Team Summary ===\n');
    
    const seasonId = 'SSPSLS17';
    
    // Get teams with dynamic slot information
    const teams = await sql`
      SELECT 
        id, 
        name,
        football_total_slots,
        football_base_slots,
        football_purchased_slots
      FROM teams
      WHERE season_id = ${seasonId}
      ORDER BY name
    `;
    
    console.log(`Found ${teams.length} teams for ${seasonId}\n`);
    
    // Get squad sizes
    const teamIds = teams.map(t => t.id);
    const squadSizes = await sql`
      SELECT 
        team_id,
        COUNT(*) as squad_size
      FROM footballplayers
      WHERE team_id = ANY(${teamIds})
      GROUP BY team_id
    `;
    
    const squadSizeMap = new Map(
      squadSizes.map(row => [row.team_id, parseInt(row.squad_size)])
    );
    
    console.log('Team Summary with Dynamic Slots:\n');
    
    teams.forEach(team => {
      const currentSquadSize = squadSizeMap.get(team.id) || 0;
      const maxSquadSize = team.football_total_slots || 25;
      const baseSlots = team.football_base_slots || 25;
      const purchasedSlots = team.football_purchased_slots || 0;
      const remainingSlots = Math.max(0, maxSquadSize - currentSquadSize);
      
      console.log(`${team.name}:`);
      console.log(`  Current Squad: ${currentSquadSize}`);
      console.log(`  Base Slots: ${baseSlots}`);
      console.log(`  Purchased Slots: ${purchasedSlots}`);
      console.log(`  Total Slots: ${maxSquadSize} ${purchasedSlots > 0 ? `(+${purchasedSlots} extra)` : ''}`);
      console.log(`  Remaining: ${remainingSlots}`);
      console.log('');
    });
    
    // Check if any team has purchased slots
    const teamsWithPurchasedSlots = teams.filter(t => (t.football_purchased_slots || 0) > 0);
    
    if (teamsWithPurchasedSlots.length > 0) {
      console.log('✅ Teams with purchased slots:');
      teamsWithPurchasedSlots.forEach(t => {
        console.log(`  - ${t.name}: +${t.football_purchased_slots} extra slots`);
      });
    } else {
      console.log('ℹ️  No teams have purchased extra slots yet');
      console.log('   (All teams using base 25 slots)');
    }
    
    console.log('\n✅ Dynamic slot system is now integrated!');
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
  }
})();
