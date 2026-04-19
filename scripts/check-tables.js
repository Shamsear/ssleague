require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.NEON_DATABASE_URL);

async function checkTables() {
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema='public' AND table_name LIKE '%round%' 
    ORDER BY table_name
  `;
  
  console.log('Round-related tables:');
  tables.forEach(t => console.log(`  - ${t.table_name}`));
}

checkTables().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
