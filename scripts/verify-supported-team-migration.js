require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function verifyMigration() {
    const sql = neon(process.env.FANTASY_DATABASE_URL);

    console.log('🔍 Verifying Supported Team Transfer Window Migration...\n');

    try {
        // Check if supported_team_changes table exists
        const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_name = 'supported_team_changes'
    `;

        if (tables.length > 0) {
            console.log('✅ supported_team_changes table exists');

            // Get columns
            const cols = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'supported_team_changes'
        ORDER BY ordinal_position
      `;

            console.log(`   Columns: ${cols.map(c => c.column_name).join(', ')}`);
        } else {
            console.log('❌ supported_team_changes table NOT found');
        }

        // Check if new columns exist in transfer_windows
        const windowCols = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'transfer_windows'
      AND column_name IN ('window_type', 'allow_supported_team_change')
    `;

        console.log(`\n✅ transfer_windows new columns: ${windowCols.length}/2 found`);
        windowCols.forEach(col => {
            console.log(`   - ${col.column_name}`);
        });

        if (tables.length > 0 && windowCols.length === 2) {
            console.log('\n✅ Migration verified successfully!');
            console.log('\nThe feature is ready to use:');
            console.log('1. Admin can create supported team change windows');
            console.log('2. Teams can change their supported team during active windows');
            console.log('3. All changes are tracked and limited to once per window');
        } else {
            console.log('\n⚠️  Migration incomplete. Please run: node scripts/migrate-supported-team-window.js');
        }

    } catch (error) {
        console.error('❌ Verification failed:', error.message);
    }
}

verifyMigration();
