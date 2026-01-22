import { neon } from '@neondatabase/serverless';

async function runMigration() {
    try {
        console.log('🔄 Starting penalty fines decimal migration...');

        // Get tournament database URL
        const databaseUrl = process.env.NEON_TOURNAMENT_DB_URL;

        if (!databaseUrl) {
            throw new Error('NEON_TOURNAMENT_DB_URL not found in environment variables');
        }

        console.log('✅ Database URL found');

        const sql = neon(databaseUrl);

        // Execute migration
        console.log('⚡ Altering ecoin_fine column...');
        await sql`ALTER TABLE tournament_penalties ALTER COLUMN ecoin_fine TYPE NUMERIC(10, 2)`;

        console.log('⚡ Altering sscoin_fine column...');
        await sql`ALTER TABLE tournament_penalties ALTER COLUMN sscoin_fine TYPE NUMERIC(10, 2)`;

        console.log('✅ Migration completed successfully!');
        console.log('');
        console.log('📊 Verifying column types...');

        // Verify the changes
        const columnInfo = await sql`
      SELECT column_name, data_type, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_name = 'tournament_penalties'
      AND column_name IN ('ecoin_fine', 'sscoin_fine')
      ORDER BY column_name
    `;

        console.log('Column types:');
        columnInfo.forEach(col => {
            console.log(`  ${col.column_name}: ${col.data_type}(${col.numeric_precision}, ${col.numeric_scale})`);
        });

        console.log('');
        console.log('🎉 Migration complete! Penalty fines now support decimal values.');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

runMigration();
