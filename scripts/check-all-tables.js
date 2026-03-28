require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkTables() {
  const sql = neon(process.env.FANTASY_DATABASE_URL);
  
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema='public' 
    ORDER BY table_name
  `;
  
  console.log('All tables in FANTASY database:');
  tables.forEach((t, i) => console.log(`${i + 1}. ${t.table_name}`));
  console.log(`\nTotal: ${tables.length} tables`);
}

checkTables().catch(console.error);
