require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkScoringRulesTable() {
  const sql = neon(process.env.FANTASY_DATABASE_URL);
  
  console.log('🔍 Looking for scoring rules table...\n');
  
  try {
    // Find tables with "scoring" in the name
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name LIKE '%scoring%'
    `;
    
    console.log('📊 Tables with "scoring" in name:');
    tables.forEach(t => console.log(`  - ${t.table_name}`));
    
    if (tables.length > 0) {
      const tableName = tables[0].table_name;
      
      // Get columns
      console.log(`\n📋 Columns in ${tableName}:`);
      const columns = await sql`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = ${tableName}
        ORDER BY ordinal_position
      `;
      columns.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type})`);
      });
      
      // Get sample data
      console.log(`\n📄 Sample data from ${tableName}:`);
      const data = await sql`SELECT * FROM ${sql(tableName)} LIMIT 1`;
      console.log(JSON.stringify(data, null, 2));
    } else {
      // Try common names
      console.log('\n🔍 Trying common table names...');
      const commonNames = ['fantasy_scoring_rules', 'scoring_rules', 'fantasy_rules', 'point_rules'];
      
      for (const name of commonNames) {
        try {
          const result = await sql`SELECT * FROM ${sql(name)} LIMIT 1`;
          console.log(`\n✅ Found table: ${name}`);
          console.log(JSON.stringify(result, null, 2));
          break;
        } catch (e) {
          console.log(`  ✗ ${name} - not found`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkScoringRulesTable();
