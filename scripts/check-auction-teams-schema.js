const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

async function checkSchema() {
  const sql = neon(process.env.NEON_AUCTION_DB_URL);
  
  console.log('Checking teams table schema in auction database...\n');
  
  const columns = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_name = 'teams' 
    ORDER BY ordinal_position
  `;
  
  console.log('Columns in teams table:');
  columns.forEach(col => {
    console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
  });
  
  console.log('\nSample data:');
  const sample = await sql`
    SELECT * FROM teams LIMIT 3
  `;
  
  if (sample.length > 0) {
    sample.forEach((row, idx) => {
      console.log(`\n--- Team ${idx + 1} ---`);
      console.log(JSON.stringify(row, null, 2));
    });
  } else {
    console.log('No data found');
  }
}

checkSchema().catch(console.error);
