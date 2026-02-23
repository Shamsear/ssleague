require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkStructure() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);
  
  console.log('🔍 Checking round_players table structure...\n');
  
  const cols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'round_players' 
    ORDER BY ordinal_position
  `;
  
  console.log('📋 round_players columns:');
  cols.forEach(c => console.log(`  - ${c.column_name}: ${c.data_type}`));
  
  console.log('\n📊 Sample data:');
  const sample = await sql`SELECT * FROM round_players LIMIT 2`;
  console.log(JSON.stringify(sample, null, 2));
}

checkStructure().catch(console.error);
