const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function checkStructure() {
  console.log('Checking footballplayers table structure...\n');
  
  const columns = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'footballplayers' 
    ORDER BY ordinal_position
  `;
  
  console.log('Footballplayers table columns:');
  columns.forEach(c => console.log(`  - ${c.column_name} (${c.data_type})`));
  
  console.log('\n\nSample record:');
  const sample = await sql`
    SELECT id, player_id, name, team_name
    FROM footballplayers
    WHERE name = 'Leon Bailey'
    LIMIT 1
  `;
  
  if (sample.length > 0) {
    console.log(JSON.stringify(sample[0], null, 2));
  }
  
  process.exit(0);
}

checkStructure().catch(err => {
  console.error(err);
  process.exit(1);
});
