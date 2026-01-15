/**
 * Migration Script: Add is_null column to matchups table
 * 
 * Run with: node scripts/add-is-null-to-matchups.js
 */

require('dotenv/config');
const { neon } = require('@neondatabase/serverless');

async function addIsNullColumn() {
    const sql = neon(process.env.TOURNAMENT_DATABASE_URL);

    try {
        console.log('🔧 Adding is_null column to matchups table...\n');

        // Check if column already exists
        const checkColumn = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'matchups' 
        AND column_name = 'is_null'
    `;

        if (checkColumn.length > 0) {
            console.log('✅ Column is_null already exists in matchups table');
            console.log('   No migration needed.\n');
            return;
        }

        // Add the column
        await sql`
      ALTER TABLE matchups
      ADD COLUMN is_null BOOLEAN DEFAULT FALSE
    `;

        console.log('✅ Successfully added is_null column to matchups table');
        console.log('   Default value: FALSE');
        console.log('   Type: BOOLEAN\n');

        // Verify the column was added
        const verify = await sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'matchups' 
        AND column_name = 'is_null'
    `;

        if (verify.length > 0) {
            console.log('📋 Column Details:');
            console.log(`   Name: ${verify[0].column_name}`);
            console.log(`   Type: ${verify[0].data_type}`);
            console.log(`   Default: ${verify[0].column_default}`);
            console.log('');
        }

        // Show count of matchups
        const count = await sql`
      SELECT COUNT(*) as total FROM matchups
    `;
        console.log(`📊 Total matchups in database: ${count[0].total}`);
        console.log('   All matchups now have is_null = FALSE by default\n');

        console.log('═══════════════════════════════════════════════════════════');
        console.log('                    MIGRATION COMPLETE');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('');
        console.log('✅ The is_null column has been added to the matchups table');
        console.log('');
        console.log('Next steps:');
        console.log('1. Use the UI to mark specific matchups as NULL');
        console.log('2. NULL matchups will not count in player stats');
        console.log('3. NULL matchups will still count for salary & team stats');
        console.log('');

    } catch (error) {
        console.error('❌ Error adding is_null column:', error);
        throw error;
    }
}

// Run the migration
addIsNullColumn()
    .then(() => {
        console.log('✅ Migration completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    });
