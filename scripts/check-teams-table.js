/**
 * Check Teams Table Structure in Auction DB
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkTeamsTable() {
    const auctionDbUrl = process.env.NEON_AUCTION_DB_URL;

    if (!auctionDbUrl) {
        console.error('❌ Error: NEON_AUCTION_DB_URL not found');
        process.exit(1);
    }

    console.log('🔍 Checking teams table structure in Auction DB...\n');

    const sql = neon(auctionDbUrl);

    try {
        // Get all columns
        const columns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'teams'
      ORDER BY ordinal_position
    `;

        console.log('📊 teams table columns:');
        console.log('─'.repeat(80));
        columns.forEach(col => {
            console.log(`${col.column_name.padEnd(30)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
        });
        console.log('─'.repeat(80));
        console.log(`\nTotal columns: ${columns.length}\n`);

        // Get sample data
        const sample = await sql`
      SELECT * FROM teams LIMIT 3
    `;

        if (sample.length > 0) {
            console.log('📝 Sample rows:');
            sample.forEach((row, i) => {
                console.log(`\nRow ${i + 1}:`);
                console.log(JSON.stringify(row, null, 2));
            });
        } else {
            console.log('⚠️  No data in teams table');
        }

        process.exit(0);

    } catch (error) {
        console.error('\n❌ Error:', error);
        console.error('Error details:', error.message);
        process.exit(1);
    }
}

checkTeamsTable().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
