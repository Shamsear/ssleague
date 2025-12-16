require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function listTables() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);
  
  const tables = await sql`
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;
  
  console.log('Tables in tournament database:');
  tables.forEach(t => console.log(`  - ${t.tablename}`));
}

listTables().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
