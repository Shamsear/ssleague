require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.NEON_DATABASE_URL);

async function checkSchema() {
  const tables = await sql`
    SELECT table_schema, table_name 
    FROM information_schema.tables 
    WHERE table_name='player_history'
  `;
  
  console.log('player_history table location:', JSON.stringify(tables, null, 2));
  
  // Get all columns
  const allCols = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns 
    WHERE table_name='player_history'
    ORDER BY ordinal_position
  `;
  
  console.log('\nAll columns (' + allCols.length + '):');
  allCols.forEach(c => console.log(`  - ${c.column_name} (${c.data_type})`));
}

checkSchema().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
