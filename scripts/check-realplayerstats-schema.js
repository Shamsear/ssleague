require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkSchema() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);
  
  const columns = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'realplayerstats'
    ORDER BY ordinal_position
  `;
  
  console.log('realplayerstats table columns:');
  columns.forEach(col => {
    console.log(`  ${col.column_name}: ${col.data_type}`);
  });
  
  // Also show a sample record
  const sample = await sql`SELECT * FROM realplayerstats LIMIT 1`;
  console.log('\nSample record:');
  console.log(sample[0]);
}

checkSchema().then(() => process.exit(0)).catch(console.error);
