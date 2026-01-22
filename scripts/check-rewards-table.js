require('dotenv').config();
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkTable() {
    const connectionString = process.env.NEON_TOURNAMENT_DB_URL;

    if (!connectionString) {
        console.error('❌ NEON_TOURNAMENT_DB_URL not set');
        process.exit(1);
    }

    const sql = neon(connectionString);

    console.log('🔍 Checking if tournament_rewards_distributed table exists...\n');

    try {
        // Try to query the table directly
        const result = await sql`
      SELECT COUNT(*) as count 
      FROM tournament_rewards_distributed
    `;

        console.log('✅ Table exists!');
        console.log(`📊 Current records: ${result[0].count}`);

        // Get table structure
        const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'tournament_rewards_distributed'
      ORDER BY ordinal_position
    `;

        console.log('\n📋 Table structure:');
        columns.forEach(col => {
            console.log(`   ${col.column_name.padEnd(20)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
        });

        // Get indexes
        const indexes = await sql`
      SELECT indexname, indexdef
      FROM pg_indexes 
      WHERE tablename = 'tournament_rewards_distributed'
    `;

        console.log('\n🔍 Indexes:');
        indexes.forEach(idx => {
            console.log(`   - ${idx.indexname}`);
        });

        console.log('\n✅ Migration was successful! Table is ready to use.');

    } catch (error) {
        if (error.message.includes('does not exist')) {
            console.log('❌ Table does not exist yet');
            console.log('\n💡 You need to run the migration first:');
            console.log('   node scripts/run-rewards-tracking-migration.js');
        } else {
            console.error('❌ Error:', error.message);
        }
        process.exit(1);
    }
}

checkTable();
