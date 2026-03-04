const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

async function checkPK() {
  const sql = neon(process.env.NEON_AUCTION_DB_URL);
  
  const pk = await sql`
    SELECT constraint_name, column_name 
    FROM information_schema.key_column_usage 
    WHERE table_name = 'teams' AND constraint_name LIKE '%pkey%'
  `;
  
  console.log('Primary key columns:', JSON.stringify(pk, null, 2));
}

checkPK().catch(console.error);
