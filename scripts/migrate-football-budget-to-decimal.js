/**
 * Migration: Change football_budget column from INTEGER to NUMERIC(10,2)
 * This allows decimal values for precise budget tracking
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_AUCTION_DB_URL);

async function migrate() {
    console.log('🔄 Migrating football_budget column to NUMERIC(10,2)...\n');

    try {
        // Alter the column type
        await sql`
      ALTER TABLE teams 
      ALTER COLUMN football_budget TYPE NUMERIC(10,2)
    `;

        console.log('✅ Column type changed successfully!');
        console.log('   football_budget: INTEGER → NUMERIC(10,2)\n');

        // Verify the change
        const result = await sql`
      SELECT column_name, data_type, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_name = 'teams' AND column_name = 'football_budget'
    `;

        console.log('📋 Verification:');
        console.log('   Column:', result[0].column_name);
        console.log('   Type:', result[0].data_type);
        console.log('   Precision:', result[0].numeric_precision);
        console.log('   Scale:', result[0].numeric_scale);
        console.log('\n✨ Migration complete!\n');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }

    process.exit(0);
}

migrate();
