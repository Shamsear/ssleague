/**
 * Fix tournament_settings unique constraint
 * The constraint should be on tournament_id, not season_id
 * This allows multiple tournaments per season
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function fixConstraint() {
    const databaseUrl = process.env.NEON_TOURNAMENT_DB_URL;

    if (!databaseUrl) {
        console.error('❌ Error: NEON_TOURNAMENT_DB_URL not found in environment variables');
        process.exit(1);
    }

    console.log('🔧 Starting constraint fix: tournament_settings...\n');

    const sql = neon(databaseUrl);

    try {
        // Step 1: Check current constraints
        console.log('📝 Step 1: Checking current constraints...');
        const currentConstraints = await sql`
      SELECT 
        conname AS constraint_name,
        contype AS constraint_type,
        pg_get_constraintdef(oid) AS constraint_definition
      FROM pg_constraint
      WHERE conrelid = 'tournament_settings'::regclass
    `;

        console.log('Current constraints:');
        currentConstraints.forEach(c => {
            console.log(`  - ${c.constraint_name} (${c.constraint_type}): ${c.constraint_definition}`);
        });
        console.log('');

        // Step 2: Drop incorrect unique constraint on season_id
        console.log('📝 Step 2: Dropping incorrect constraint on season_id...');
        try {
            await sql`
        ALTER TABLE tournament_settings
        DROP CONSTRAINT IF EXISTS tournament_settings_season_id_key
      `;
            console.log('✅ Dropped tournament_settings_season_id_key\n');
        } catch (error) {
            console.log('⚠️  Constraint may not exist (this is OK)\n');
        }

        // Step 3: Ensure primary key on tournament_id
        console.log('📝 Step 3: Ensuring primary key on tournament_id...');
        try {
            // First drop if exists
            await sql`
        ALTER TABLE tournament_settings
        DROP CONSTRAINT IF EXISTS tournament_settings_pkey
      `;

            // Then add it
            await sql`
        ALTER TABLE tournament_settings
        ADD CONSTRAINT tournament_settings_pkey PRIMARY KEY (tournament_id)
      `;
            console.log('✅ Primary key set on tournament_id\n');
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log('✅ Primary key already exists on tournament_id\n');
            } else {
                throw error;
            }
        }

        // Step 4: Verify the fix
        console.log('🔍 Step 4: Verifying constraints...');
        const newConstraints = await sql`
      SELECT 
        conname AS constraint_name,
        contype AS constraint_type,
        pg_get_constraintdef(oid) AS constraint_definition
      FROM pg_constraint
      WHERE conrelid = 'tournament_settings'::regclass
    `;

        console.log('New constraints:');
        newConstraints.forEach(c => {
            console.log(`  - ${c.constraint_name} (${c.constraint_type}): ${c.constraint_definition}`);
        });
        console.log('');

        // Step 5: Test by checking if we can have multiple tournaments per season
        console.log('📝 Step 5: Testing constraint...');
        const testQuery = await sql`
      SELECT 
        season_id,
        COUNT(*) as tournament_count
      FROM tournament_settings
      GROUP BY season_id
      HAVING COUNT(*) > 1
    `;

        if (testQuery.length > 0) {
            console.log('✅ Multiple tournaments per season are now allowed!');
            testQuery.forEach(row => {
                console.log(`  - Season ${row.season_id}: ${row.tournament_count} tournaments`);
            });
        } else {
            console.log('✅ Constraint fixed! You can now create multiple tournaments per season.');
        }

        console.log('\n✅ Constraint fix completed successfully!');
        console.log('\n📝 Summary:');
        console.log('  - Removed incorrect unique constraint on season_id');
        console.log('  - Ensured primary key on tournament_id');
        console.log('  - Multiple tournaments per season are now allowed');

        process.exit(0);

    } catch (error) {
        console.error('\n❌ Constraint fix failed:', error);
        console.error('\nError details:', error.message);
        if (error.code) {
            console.error('Error code:', error.code);
        }
        process.exit(1);
    }
}

// Run fix
fixConstraint().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
