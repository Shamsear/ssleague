const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_DATABASE_URL);

async function checkTables() {
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `;
  
  console.log('All tables in tournament database:');
  tables.forEach(t => console.log('  -', t.table_name));
}

checkTables();
