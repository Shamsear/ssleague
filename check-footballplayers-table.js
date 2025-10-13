// Check footballplayers table structure
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

async function checkTable() {
  try {
    console.log('Checking footballplayers table structure...\n');
    
    // Get all columns
    const columns = await sql`
      SELECT 
        column_name, 
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'footballplayers'
      ORDER BY ordinal_position
    `;
    
    console.log('Columns in footballplayers table:\n');
    columns.forEach(col => {
      console.log(`- ${col.column_name}`);
      console.log(`  Type: ${col.data_type}`);
      console.log(`  Nullable: ${col.is_nullable}`);
      if (col.column_default) {
        console.log(`  Default: ${col.column_default}`);
      }
      console.log('');
    });
    
    console.log(`Total columns: ${columns.length}\n`);
    
    // Get a sample record
    console.log('Sample record:\n');
    const sample = await sql`
      SELECT * FROM footballplayers LIMIT 1
    `;
    
    if (sample.length > 0) {
      console.log('Fields in actual data:');
      Object.keys(sample[0]).forEach(key => {
        const value = sample[0][key];
        const valueStr = value === null ? 'NULL' : (typeof value === 'string' && value.length > 50 ? value.substring(0, 50) + '...' : value);
        console.log(`  ${key}: ${valueStr}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

checkTable();
