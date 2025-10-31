require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkSchema() {
  const sql = neon(process.env.NEON_AUCTION_DB_URL);
  
  try {
    const result = await sql`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'footballplayers' 
      ORDER BY ordinal_position
    `;
    
    console.log('\n📋 footballplayers table schema:');
    console.log('─'.repeat(60));
    result.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      console.log(`  ${col.column_name.padEnd(30)} ${col.data_type.padEnd(15)} ${nullable}`);
    });
    console.log('─'.repeat(60));
    console.log(`\n✅ Total columns: ${result.length}\n`);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkSchema();
