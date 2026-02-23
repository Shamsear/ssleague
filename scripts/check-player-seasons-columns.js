require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkColumns() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);
  
  console.log('🔍 Checking player_seasons columns...\n');
  
  const cols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'player_seasons' 
    ORDER BY ordinal_position
  `;
  
  console.log('📋 player_seasons columns:');
  cols.forEach(c => console.log(`  - ${c.column_name}: ${c.data_type}`));
}

checkColumns().catch(console.error);
