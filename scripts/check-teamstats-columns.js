/**
 * Check teamstats table structure
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkTeamstatsColumns() {
    const databaseUrl = process.env.NEON_TOURNAMENT_DB_URL;

    if (!databaseUrl) {
        console.error('❌ Error: NEON_TOURNAMENT_DB_URL not found');
        process.exit(1);
    }

    console.log('🔍 Checking teamstats table structure...\n');

    const sql = neon(databaseUrl);

    try {
        // Get all columns
        const columns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'teamstats'
      ORDER BY ordinal_position
    `;

        console.log('📊 teamstats table columns:');
        console.log('─'.repeat(80));
        columns.forEach(col => {
            console.log(`${col.column_name.padEnd(30)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
        });
        console.log('─'.repeat(80));
        console.log(`\nTotal columns: ${columns.length}\n`);

        // Get sample data
        const sample = await sql`
      SELECT * FROM teamstats LIMIT 1
    `;

        if (sample.length > 0) {
            console.log('📝 Sample row (first record):');
            console.log(JSON.stringify(sample[0], null, 2));
        } else {
            console.log('⚠️  No data in teamstats table');
        }

        process.exit(0);

    } catch (error) {
        console.error('\n❌ Error:', error);
        console.error('Error details:', error.message);
        process.exit(1);
    }
}

checkTeamstatsColumns().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
