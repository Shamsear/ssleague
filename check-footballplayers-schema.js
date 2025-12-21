const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

(async () => {
  const cols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'footballplayers' 
    ORDER BY ordinal_position
  `;
  
  console.log('footballplayers columns:');
  cols.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}`));
  
  // Get sample data
  const sample = await sql`SELECT * FROM footballplayers LIMIT 1`;
  console.log('\nSample row:');
  console.log(sample[0]);
})();
