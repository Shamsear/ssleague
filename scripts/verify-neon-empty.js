const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_DATABASE_URL);

async function verifyEmpty() {
  console.log('🔍 Verifying all Neon tables are empty...\n');
  
  try {
    // Get all tables
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    
    console.log(`Found ${tables.length} tables\n`);
    
    let totalRecords = 0;
    let nonEmptyTables = [];
    
    for (const table of tables) {
      const tableName = table.table_name;
      const result = await sql.unsafe(`SELECT COUNT(*) as count FROM ${tableName}`);
      const count = parseInt(result[0]?.count || 0);
      
      if (count > 0) {
        console.log(`❌ ${tableName}: ${count} records`);
        nonEmptyTables.push({ table: tableName, count });
        totalRecords += count;
      } else {
        console.log(`✅ ${tableName}: empty`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    if (nonEmptyTables.length > 0) {
      console.log(`\n⚠️  WARNING: ${nonEmptyTables.length} tables are NOT empty!`);
      console.log(`Total records found: ${totalRecords}\n`);
      console.log('Tables with data:');
      nonEmptyTables.forEach(t => {
        console.log(`  - ${t.table}: ${t.count} records`);
      });
    } else {
      console.log('\n✅ All tables are empty!');
    }
    console.log('\n' + '='.repeat(60));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

verifyEmpty();
