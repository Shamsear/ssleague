/**
 * Show ALL data in Neon Database
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_DATABASE_URL);

async function showAllData() {
  console.log('🔍 SHOWING ALL DATA IN NEON DATABASE\n');
  console.log('='.repeat(80) + '\n');
  
  try {
    // Get all tables
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    
    for (const table of tables) {
      const tableName = table.table_name;
      const result = await sql.unsafe(`SELECT COUNT(*) as count FROM ${tableName}`);
      const count = parseInt(result[0]?.count || 0);
      
      console.log(`\n📊 TABLE: ${tableName.toUpperCase()}`);
      console.log('-'.repeat(80));
      console.log(`Records: ${count}`);
      
      if (count > 0) {
        // Show all data for tables with data
        const allData = await sql.unsafe(`SELECT * FROM ${tableName}`);
        console.log('\nData:');
        allData.forEach((row, index) => {
          console.log(`\n[Row ${index + 1}]`);
          console.log(JSON.stringify(row, null, 2));
        });
      } else {
        console.log('(empty)');
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Complete');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

showAllData();
