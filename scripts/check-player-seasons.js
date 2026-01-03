require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkSchema() {
    const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

    console.log('🔍 Checking player_seasons schema...\n');

    // Check if table exists
    const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    AND table_name = 'player_seasons'
  `;

    if (tables.length === 0) {
        console.log('❌ player_seasons table does NOT exist!');

        // Show all player-related tables
        const allTables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

        console.log('\n📋 All tables in tournament database:');
        allTables.forEach(t => console.log(`  - ${t.table_name}`));
        return;
    }

    console.log('✅ player_seasons table exists!\n');

    // Get schema
    console.log('📋 Columns in player_seasons:');
    const cols = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns 
    WHERE table_name = 'player_seasons'
    ORDER BY ordinal_position
  `;

    cols.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type})`);
    });

    // Get sample row
    console.log('\n📊 Sample row:');
    const sample = await sql`SELECT * FROM player_seasons LIMIT 1`;

    if (sample.length > 0) {
        console.log(JSON.stringify(sample[0], null, 2));
    }

    console.log('\n✅ Done!');
}

checkSchema().catch(console.error);
