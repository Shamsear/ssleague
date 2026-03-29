const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function checkColumns() {
  try {
    console.log('Checking footballplayers table columns...\n');
    
    const columns = await sql`
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'footballplayers'
      ORDER BY ordinal_position
    `;
    
    console.log(`Found ${columns.length} columns:\n`);
    
    columns.forEach((col, index) => {
      console.log(`${index + 1}. ${col.column_name}`);
      console.log(`   Type: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}`);
      console.log(`   Nullable: ${col.is_nullable}`);
      if (col.column_default) {
        console.log(`   Default: ${col.column_default}`);
      }
      console.log('');
    });
    
    // Check for contract-related columns
    const contractColumns = columns.filter(col => 
      col.column_name.includes('contract') || 
      col.column_name.includes('season_start') || 
      col.column_name.includes('season_end')
    );
    
    if (contractColumns.length > 0) {
      console.log('\nContract-related columns found:');
      contractColumns.forEach(col => {
        console.log(`  - ${col.column_name}`);
      });
    } else {
      console.log('\nNo contract-related columns found in footballplayers table.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkColumns();
