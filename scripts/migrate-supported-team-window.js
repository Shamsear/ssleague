require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    const sql = neon(process.env.FANTASY_DATABASE_URL);

    console.log('🔧 Running Supported Team Transfer Window Migration...\n');

    try {
        // Read the migration file
        const migrationPath = path.join(__dirname, '..', 'database', 'migrations', 'add-supported-team-transfer-window.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        // Split by semicolons and execute each statement
        const statements = migrationSQL
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        console.log(`Found ${statements.length} SQL statements to execute\n`);

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            console.log(`Executing statement ${i + 1}/${statements.length}...`);

            try {
                await sql.unsafe(statement);
                console.log(`✅ Statement ${i + 1} executed successfully\n`);
            } catch (error) {
                // Some statements might fail if already exist, that's okay
                if (error.message.includes('already exists')) {
                    console.log(`⚠️  Statement ${i + 1} skipped (already exists)\n`);
                } else {
                    console.error(`❌ Statement ${i + 1} failed:`, error.message, '\n');
                }
            }
        }

        console.log('✅ Migration completed!\n');

        // Verify the changes
        console.log('🔍 Verifying migration...\n');

        // Check if supported_team_changes table exists
        const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_name = 'supported_team_changes'
    `;

        if (tables.length > 0) {
            console.log('✅ supported_team_changes table created successfully');
        } else {
            console.log('❌ supported_team_changes table not found');
        }

        // Check if new columns exist in transfer_windows
        const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'transfer_windows'
      AND column_name IN ('window_type', 'allow_supported_team_change')
    `;

        if (columns.length === 2) {
            console.log('✅ New columns added to transfer_windows table');
        } else {
            console.log(`⚠️  Only ${columns.length}/2 columns found in transfer_windows`);
        }

        console.log('\n✅ All done! The feature is ready to use.');
        console.log('\nNext steps:');
        console.log('1. Admin can create a supported team change window');
        console.log('2. Teams can change their supported team during the window');
        console.log('3. Check the documentation in .docs/supported-team-transfer-window.md');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
