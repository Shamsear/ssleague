/**
 * Add missing tournament fields migration
 * Adds rewards, number_of_teams, enable_category_requirements, lineup_category_requirements
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function runMigration() {
    const databaseUrl = process.env.NEON_TOURNAMENT_DB_URL;

    if (!databaseUrl) {
        console.error('❌ Error: NEON_TOURNAMENT_DB_URL not found in environment variables');
        process.exit(1);
    }

    console.log('🚀 Starting migration: Add missing tournament fields...\n');

    const sql = neon(databaseUrl);

    try {
        // Step 1: Add rewards column to tournaments
        console.log('📝 Step 1: Adding rewards column to tournaments...');
        await sql`
      ALTER TABLE tournaments
      ADD COLUMN IF NOT EXISTS rewards JSONB DEFAULT NULL
    `;
        console.log('✅ rewards column added\n');

        // Step 2: Add number_of_teams column to tournaments
        console.log('📝 Step 2: Adding number_of_teams column to tournaments...');
        await sql`
      ALTER TABLE tournaments
      ADD COLUMN IF NOT EXISTS number_of_teams INTEGER DEFAULT 16
    `;
        console.log('✅ number_of_teams column added\n');

        // Step 3: Add enable_category_requirements to tournament_settings
        console.log('📝 Step 3: Adding enable_category_requirements to tournament_settings...');
        await sql`
      ALTER TABLE tournament_settings
      ADD COLUMN IF NOT EXISTS enable_category_requirements BOOLEAN DEFAULT FALSE
    `;
        console.log('✅ enable_category_requirements column added\n');

        // Step 4: Add lineup_category_requirements to tournament_settings
        console.log('📝 Step 4: Adding lineup_category_requirements to tournament_settings...');
        await sql`
      ALTER TABLE tournament_settings
      ADD COLUMN IF NOT EXISTS lineup_category_requirements JSONB DEFAULT '{}'::jsonb
    `;
        console.log('✅ lineup_category_requirements column added\n');

        // Step 5: Add comments
        console.log('📝 Step 5: Adding column documentation...');
        await sql`
      COMMENT ON COLUMN tournaments.rewards IS 'Tournament reward configuration (match results, positions, knockout stages)'
    `;
        await sql`
      COMMENT ON COLUMN tournaments.number_of_teams IS 'Total number of teams participating in the tournament'
    `;
        await sql`
      COMMENT ON COLUMN tournament_settings.enable_category_requirements IS 'Whether category requirements are enabled for lineups'
    `;
        await sql`
      COMMENT ON COLUMN tournament_settings.lineup_category_requirements IS 'Category-specific lineup requirements (e.g., minimum Legend players)'
    `;
        console.log('✅ Documentation added\n');

        // Step 6: Verify
        console.log('🔍 Step 6: Verifying columns...');
        const tournamentsColumns = await sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'tournaments' AND column_name IN ('rewards', 'number_of_teams')
      ORDER BY column_name
    `;

        const settingsColumns = await sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'tournament_settings' 
      AND column_name IN ('enable_category_requirements', 'lineup_category_requirements')
      ORDER BY column_name
    `;

        console.log('Tournaments table columns:');
        tournamentsColumns.forEach(col => {
            console.log(`  - ${col.column_name} (${col.data_type})`);
        });

        console.log('\nTournament Settings table columns:');
        settingsColumns.forEach(col => {
            console.log(`  - ${col.column_name} (${col.data_type})`);
        });

        console.log('\n✅ Migration completed successfully!');
        console.log('\n📝 Summary:');
        console.log('  - Added rewards column to tournaments (JSONB)');
        console.log('  - Added number_of_teams column to tournaments (INTEGER)');
        console.log('  - Added enable_category_requirements to tournament_settings (BOOLEAN)');
        console.log('  - Added lineup_category_requirements to tournament_settings (JSONB)');
        console.log('  - All columns documented');

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
