import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
    try {
        console.log('🔄 Starting penalty fines decimal migration...');

        // Get tournament database URL
        const databaseUrl = process.env.TOURNAMENT_DATABASE_URL;

        if (!databaseUrl) {
            throw new Error('TOURNAMENT_DATABASE_URL not found in environment variables');
        }

        console.log('✅ Database URL found');

        const sql = neon(databaseUrl);

        // Read migration file
        const migrationPath = join(__dirname, 'migrations', 'update-penalty-fines-to-decimal.sql');
        const migrationSQL = readFileSync(migrationPath, 'utf-8');

        console.log('📝 Migration SQL:');
        console.log(migrationSQL);
        console.log('');

        // Execute migration
        console.log('⚡ Executing migration...');
        await sql.unsafe(migrationSQL);

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

        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
