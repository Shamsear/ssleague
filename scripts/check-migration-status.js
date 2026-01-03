require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkMigration() {
    const sql = neon(process.env.FANTASY_DATABASE_URL);

    console.log('🔍 Checking Migration Status...\n');

    try {
        // Check for supported_team_changes table
        console.log('1️⃣ Checking supported_team_changes table...');
        const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'supported_team_changes'
      ) as exists
    `;

        if (tableCheck[0].exists) {
            console.log('   ✅ supported_team_changes table exists');

            // Count rows
            const count = await sql`SELECT COUNT(*) as count FROM supported_team_changes`;
            console.log(`   📊 Current records: ${count[0].count}`);
        } else {
            console.log('   ❌ supported_team_changes table NOT found');
        }

        // Check transfer_windows columns
        console.log('\n2️⃣ Checking transfer_windows columns...');
        const columns = await sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'transfer_windows'
      AND column_name IN ('window_type', 'allow_supported_team_change')
      ORDER BY column_name
    `;

        if (columns.length > 0) {
            console.log(`   ✅ Found ${columns.length}/2 new columns:`);
            columns.forEach(col => {
                console.log(`      - ${col.column_name} (${col.data_type})`);
                console.log(`        Default: ${col.column_default}`);
            });
        } else {
            console.log('   ❌ No new columns found in transfer_windows');
        }

        // Check indexes
        console.log('\n3️⃣ Checking indexes...');
        const indexes = await sql`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'supported_team_changes'
      AND schemaname = 'public'
    `;

        if (indexes.length > 0) {
            console.log(`   ✅ Found ${indexes.length} indexes:`);
            indexes.forEach(idx => {
                console.log(`      - ${idx.indexname}`);
            });
        } else {
            console.log('   ⚠️  No indexes found (table might not exist)');
        }

        // Overall status
        console.log('\n' + '='.repeat(50));
        if (tableCheck[0].exists && columns.length === 2) {
            console.log('✅ Migration SUCCESSFUL!');
            console.log('\nYou can now:');
            console.log('1. Create supported team change windows (admin)');
            console.log('2. Allow teams to change their supported team');
        } else {
            console.log('⚠️  Migration INCOMPLETE');
            console.log('\nIssues found:');
            if (!tableCheck[0].exists) {
                console.log('- supported_team_changes table missing');
            }
            if (columns.length < 2) {
                console.log(`- Only ${columns.length}/2 columns added to transfer_windows`);
            }
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

checkMigration();
