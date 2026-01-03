require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkTables() {
    if (!process.env.FANTASY_DATABASE_URL) {
        console.error('❌ FANTASY_DATABASE_URL not found');
        process.exit(1);
    }

    const sql = neon(process.env.FANTASY_DATABASE_URL);

    console.log('🔍 Checking Fantasy Database Tables...\n');

    // List all tables
    const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name
  `;

    console.log('📋 Available Tables:');
    tables.forEach(table => {
        console.log(`  - ${table.table_name}`);
    });

    // Check fantasy_players schema
    console.log('\n📋 fantasy_players columns:');
    const cols = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns 
    WHERE table_name = 'fantasy_players'
    ORDER BY ordinal_position
  `;

    cols.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type})`);
    });

    // Sample fantasy_players data
    console.log('\n📊 Sample fantasy_players:');
    const players = await sql`
    SELECT *
    FROM fantasy_players
    LIMIT 5
  `;

    players.forEach((p, i) => {
        console.log(`\n${i + 1}. Player:`, JSON.stringify(p, null, 2));
    });

    console.log('\n✅ Done!');
}

checkTables().catch(console.error);
