require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkTables() {
  const sql = neon(process.env.NEON_DATABASE_URL);
  
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema='public' 
    AND table_name LIKE 'fantasy_%' 
    ORDER BY table_name
  `;
  
  console.log('Fantasy tables in database:');
  tables.forEach((t, i) => console.log(`${i + 1}. ${t.table_name}`));
  console.log(`\nTotal: ${tables.length} tables`);
}

checkTables().catch(console.error);
