const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

async function checkSlotPurchases() {
  try {
    const purchases = await sql`
      SELECT 
        team_id, 
        SUM(slots_purchased) as total_slots, 
        SUM(total_cost) as total_cost 
      FROM football_slot_purchases 
      WHERE season_id = 'SSPSLS17' 
      GROUP BY team_id 
      ORDER BY team_id
    `;
    
    console.log(JSON.stringify(purchases, null, 2));
  } catch (error) {
    console.log('Error:', error.message);
  }
}

checkSlotPurchases().catch(console.error);
