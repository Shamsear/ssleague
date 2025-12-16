const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

async function listTables() {
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' 
    ORDER BY table_name
  `;
  
  console.log('Tournament DB tables:');
  tables.forEach(t => console.log('  -', t.table_name));
}

listTables();
