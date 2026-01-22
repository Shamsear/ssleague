/**
 * Migration: Add ECoin and SSCoin fine columns to tournament_penalties
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function runMigration() {
    const databaseUrl = process.env.NEON_TOURNAMENT_DB_URL;

    if (!databaseUrl) {
        console.error('❌ Error: NEON_TOURNAMENT_DB_URL not found in environment variables');
        process.exit(1);
    }

    console.log('🚀 Starting migration: Add penalty fines...\n');

    const sql = neon(databaseUrl);

    try {
        console.log('📝 Adding ecoin_fine column...');
        await sql`
      ALTER TABLE tournament_penalties
      ADD COLUMN IF NOT EXISTS ecoin_fine INTEGER DEFAULT 0
    `;

        console.log('📝 Adding sscoin_fine column...');
        await sql`
      ALTER TABLE tournament_penalties
      ADD COLUMN IF NOT EXISTS sscoin_fine INTEGER DEFAULT 0
    `;

        console.log('✅ Columns added successfully!\n');

        // Verify the changes
        console.log('🔍 Verifying changes...\n');
        const columns = await sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'tournament_penalties'
      AND column_name IN ('ecoin_fine', 'sscoin_fine')
      ORDER BY column_name
    `;

        if (columns.length === 2) {
            console.log('✅ Verification successful!');
            console.log('📊 New columns added:');
            columns.forEach(col => {
                console.log(`   - ${col.column_name} (${col.data_type}) DEFAULT ${col.column_default}`);
            });
        } else {
            console.log('⚠️  Warning: Expected 2 columns, found', columns.length);
        }

        console.log('\n✅ Migration complete!');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Migration failed!');
        console.error('Error:', error);
        console.error('\nDetails:', error.message);
        process.exit(1);
    }
}

runMigration().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
