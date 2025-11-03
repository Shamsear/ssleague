const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_DATABASE_URL);

async function fixAuctionSettingsSchema() {
  console.log('🔧 Fixing auction_settings table schema...\n');

  try {
    // Check current columns
    console.log('📋 Checking current columns...');
    const currentColumns = await sql`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'auction_settings'
      ORDER BY ordinal_position
    `;
    
    console.log('Current columns:');
    currentColumns.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });

    // Check if max_rounds exists
    const hasMaxRounds = currentColumns.some(col => col.column_name === 'max_rounds');

    if (!hasMaxRounds) {
      console.log('\n⚠️  max_rounds column is missing. Adding it now...');
      
      await sql`
        ALTER TABLE auction_settings 
        ADD COLUMN max_rounds INTEGER NOT NULL DEFAULT 25
      `;
      
      console.log('✅ max_rounds column added successfully!');
    } else {
      console.log('\n✅ max_rounds column already exists');
    }

    // Check if min_balance_per_round exists
    const hasMinBalance = currentColumns.some(col => col.column_name === 'min_balance_per_round');
    
    if (!hasMinBalance) {
      console.log('\n⚠️  min_balance_per_round column is missing. Adding it now...');
      
      await sql`
        ALTER TABLE auction_settings 
        ADD COLUMN min_balance_per_round INTEGER NOT NULL DEFAULT 30
      `;
      
      console.log('✅ min_balance_per_round column added successfully!');
    } else {
      console.log('✅ min_balance_per_round column already exists');
    }

    // Check if contract_duration exists
    const hasContractDuration = currentColumns.some(col => col.column_name === 'contract_duration');
    
    if (!hasContractDuration) {
      console.log('\n⚠️  contract_duration column is missing. Adding it now...');
      
      await sql`
        ALTER TABLE auction_settings 
        ADD COLUMN contract_duration INTEGER NOT NULL DEFAULT 2
      `;
      
      console.log('✅ contract_duration column added successfully!');
    } else {
      console.log('✅ contract_duration column already exists');
    }

    // Show final schema
    console.log('\n📋 Final schema:');
    const finalColumns = await sql`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'auction_settings'
      ORDER BY ordinal_position
    `;
    
    finalColumns.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}) ${col.column_default ? `[default: ${col.column_default}]` : ''}`);
    });

    console.log('\n🎉 Schema fix complete!');

  } catch (error) {
    console.error('❌ Error fixing schema:', error);
    process.exit(1);
  }
}

fixAuctionSettingsSchema();
