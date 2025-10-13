/**
 * Script to update minimum bid amount from 100 to 10
 * This updates the database constraint to allow bids starting from £10
 */

const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

async function updateMinimumBid() {
  console.log('🔄 Updating minimum bid amount constraint...\n');

  try {
    // Drop the old constraint
    console.log('1️⃣ Dropping old constraint...');
    await sql`ALTER TABLE bids DROP CONSTRAINT IF EXISTS bids_amount_check`;
    console.log('   ✅ Old constraint dropped\n');

    // Add new constraint with minimum of 10
    console.log('2️⃣ Adding new constraint (minimum: £10)...');
    await sql`ALTER TABLE bids ADD CONSTRAINT bids_amount_check CHECK (amount >= 10)`;
    console.log('   ✅ New constraint added\n');

    // Verify the change
    console.log('3️⃣ Verifying constraint...');
    const result = await sql`
      SELECT 
        conname as constraint_name,
        pg_get_constraintdef(oid) as constraint_definition
      FROM pg_constraint
      WHERE conrelid = 'bids'::regclass
        AND conname = 'bids_amount_check'
    `;

    if (result.length > 0) {
      console.log('   ✅ Constraint verified:');
      console.log(`   Name: ${result[0].constraint_name}`);
      console.log(`   Definition: ${result[0].constraint_definition}\n`);
    }

    console.log('✅ Migration completed successfully!\n');
    console.log('═══════════════════════════════════════');
    console.log('Summary:');
    console.log('  - Old minimum bid: £100');
    console.log('  - New minimum bid: £10');
    console.log('  - Teams can now place bids from £10');
    console.log('═══════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
updateMinimumBid()
  .then(() => {
    console.log('✅ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
