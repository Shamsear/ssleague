const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_AUCTION_DB_URL);

async function checkStructure() {
  const cols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'teams' 
    ORDER BY ordinal_position
  `;
  
  console.log('Teams table columns:');
  cols.forEach(c => console.log(`  - ${c.column_name} (${c.data_type})`));
  process.exit(0);
}

checkStructure();
