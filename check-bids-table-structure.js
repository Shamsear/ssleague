const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function checkStructure() {
  console.log('Checking bids table structure...\n');
  
  const columns = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'bids' 
    ORDER BY ordinal_position
  `;
  
  console.log('Bids table columns:');
  columns.forEach(c => console.log(`  - ${c.column_name} (${c.data_type})`));
  
  console.log('\n\nChecking bulk_tiebreaker table structure...\n');
  
  const tbColumns = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'bulk_tiebreaker' 
    ORDER BY ordinal_position
  `;
  
  console.log('Bulk_tiebreaker table columns:');
  tbColumns.forEach(c => console.log(`  - ${c.column_name} (${c.data_type})`));
  
  process.exit(0);
}

checkStructure().catch(err => {
  console.error(err);
  process.exit(1);
});
