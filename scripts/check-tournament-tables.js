require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkTournamentTables() {
    const sql = neon(process.env.NEON_DATABASE_URL);

    console.log('🔍 Checking Tournament Database Tables...\n');

    // List all tables
    const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    AND table_name LIKE '%player%'
    ORDER BY table_name
  `;

    console.log('📋 Player-related Tables:');
    tables.forEach(table => {
        console.log(`  - ${table.table_name}`);
    });

    console.log('\n✅ Done!');
}

checkTournamentTables().catch(console.error);
