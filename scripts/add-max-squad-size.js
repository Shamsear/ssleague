const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_DATABASE_URL);

async function addMaxSquadSize() {
  console.log('🔧 Adding max_squad_size column to auction_settings...\n');

  try {
    // Check if column exists
    const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'auction_settings' 
      AND column_name = 'max_squad_size'
    `;

    if (columns.length === 0) {
      console.log('⚠️  max_squad_size column is missing. Adding it now...');
      
      await sql`
        ALTER TABLE auction_settings 
        ADD COLUMN max_squad_size INTEGER NOT NULL DEFAULT 25
      `;
      
      console.log('✅ max_squad_size column added successfully!');
    } else {
      console.log('✅ max_squad_size column already exists');
    }

    // Show final schema
    console.log('\n📋 Current auction_settings schema:');
    const finalColumns = await sql`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'auction_settings'
      ORDER BY ordinal_position
    `;
    
    finalColumns.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}) ${col.column_default ? `[default: ${col.column_default}]` : ''}`);
    });

    console.log('\n🎉 Migration complete!');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addMaxSquadSize();
