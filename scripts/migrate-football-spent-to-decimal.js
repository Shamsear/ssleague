/**
 * Migration: Change football_spent column from INTEGER to NUMERIC(10,2)
 * This allows decimal values for precise tracking
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_AUCTION_DB_URL);

async function migrate() {
    console.log('🔄 Migrating football_spent column to NUMERIC(10,2)...\n');

    try {
        // Alter the column type
        await sql`
      ALTER TABLE teams 
      ALTER COLUMN football_spent TYPE NUMERIC(10,2)
    `;

        console.log('✅ Column type changed successfully!');
        console.log('   football_spent: INTEGER → NUMERIC(10,2)\n');

        // Verify the change
        const result = await sql`
      SELECT column_name, data_type, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_name = 'teams' AND column_name IN ('football_budget', 'football_spent')
      ORDER BY column_name
    `;

        console.log('📋 Verification:');
        result.forEach(col => {
            console.log(`   ${col.column_name.padEnd(20)} Type: ${col.data_type.padEnd(15)} Precision: ${col.numeric_precision}  Scale: ${col.numeric_scale}`);
        });
        console.log('\n✨ Migration complete!\n');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }

    process.exit(0);
}

migrate();
