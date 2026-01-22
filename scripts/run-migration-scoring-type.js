/**
 * Run database migration to add scoring_type column to tournament_settings
 * Usage: node scripts/run-migration-scoring-type.js
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function runMigration() {
    const databaseUrl = process.env.NEON_TOURNAMENT_DB_URL;

    if (!databaseUrl) {
        console.error('❌ Error: NEON_TOURNAMENT_DB_URL not found in environment variables');
        process.exit(1);
    }

    console.log('🚀 Starting migration: Add scoring_type to tournament_settings...\n');

    const sql = neon(databaseUrl);

    try {
        // Step 1: Add column (without CHECK constraint in same statement)
        console.log('📝 Step 1: Adding scoring_type column...');
        await sql`
      ALTER TABLE tournament_settings
      ADD COLUMN IF NOT EXISTS scoring_type VARCHAR(20) DEFAULT 'goals'
    `;
        console.log('✅ Column added successfully\n');

        // Step 2: Update existing records
        console.log('📝 Step 2: Setting default values for existing records...');
        const updateResult = await sql`
      UPDATE tournament_settings 
      SET scoring_type = 'goals' 
      WHERE scoring_type IS NULL
    `;
        console.log(`✅ Updated ${updateResult.count || 0} records\n`);

        // Step 3: Add index
        console.log('📝 Step 3: Adding index for performance...');
        await sql`
      CREATE INDEX IF NOT EXISTS idx_tournament_settings_scoring_type 
      ON tournament_settings(scoring_type)
    `;
        console.log('✅ Index created successfully\n');

        // Verify migration
        console.log('🔍 Verifying migration...');
        const verification = await sql`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'tournament_settings' AND column_name = 'scoring_type'
    `;

        if (verification.length > 0) {
            console.log('✅ Migration verified successfully!');
            console.log('Column details:', verification[0]);
            console.log('\n');
        } else {
            console.log('⚠️  Warning: Could not verify column creation');
        }

        // Check existing tournament settings
        console.log('📊 Checking existing tournament settings...');
        const existingSettings = await sql`
      SELECT tournament_id, scoring_type
      FROM tournament_settings
      LIMIT 5
    `;

        if (existingSettings.length > 0) {
            console.log(`Found ${existingSettings.length} tournament settings (showing first 5):`);
            existingSettings.forEach(setting => {
                console.log(`  - ${setting.tournament_id}: ${setting.scoring_type}`);
            });
        } else {
            console.log('No existing tournament settings found');
        }

        console.log('\n✅ Migration completed successfully!');
        console.log('\n📝 Summary:');
        console.log('  - scoring_type column added to tournament_settings');
        console.log('  - Default value: "goals"');
        console.log('  - Allowed values: "goals", "wins", "hybrid" (enforced by application)');
        console.log('  - Index created for performance');
        console.log('  - All existing tournaments set to "goals" (backward compatible)');

        process.exit(0);

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        console.error('\nError details:', error.message);
        if (error.code) {
            console.error('Error code:', error.code);
        }
        process.exit(1);
    }
}

// Run migration
runMigration().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
