require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.NEON_AUCTION_DB_URL || process.env.NEON_DATABASE_URL);

async function checkSchema() {
  const columns = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name='teams' 
    ORDER BY ordinal_position
  `;
  
  console.log('Teams table columns:');
  columns.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}`));
}

checkSchema().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
