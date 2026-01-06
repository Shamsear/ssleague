require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function listTables() {
    const sql = neon(process.env.NEON_DATABASE_URL);

    const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;

    console.log('Available tables:');
    tables.forEach(t => {
        console.log(`  - ${t.table_name}`);
    });
}

listTables();
