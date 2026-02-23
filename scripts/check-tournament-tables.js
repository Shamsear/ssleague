require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkTables() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);
  
  console.log('🔍 Checking tournament database tables...\n');
  
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `;
  
  console.log('📋 Available tables:');
  tables.forEach(t => console.log(`  - ${t.table_name}`));
  
  // Check fixtures table structure
  console.log('\n📊 Fixtures table columns:');
  const fixtureCols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'fixtures' 
    ORDER BY ordinal_position
  `;
  fixtureCols.forEach(c => console.log(`  - ${c.column_name}: ${c.data_type}`));
  
  // Check matchups table structure
  console.log('\n📊 Matchups table columns:');
  const matchupCols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'matchups' 
    ORDER BY ordinal_position
  `;
  matchupCols.forEach(c => console.log(`  - ${c.column_name}: ${c.data_type}`));
}

checkTables().catch(console.error);
