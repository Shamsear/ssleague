require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function testMigration() {
  const sql = neon(process.env.FANTASY_DATABASE_URL);
  
  try {
    console.log('Testing simple table creation...');
    
    // Try creating a simple test table
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS test_engagement_table (
        id SERIAL PRIMARY KEY,
        test_column VARCHAR(100)
      );
    `);
    
    console.log('✅ Test table created successfully');
    
    // Check if it exists
    const result = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'test_engagement_table'
      )
    `;
    
    console.log('Table exists:', result[0].exists);
    
    // Clean up
    await sql.unsafe(`DROP TABLE IF EXISTS test_engagement_table;`);
    console.log('✅ Test table dropped');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
  }
}

testMigration().catch(console.error);
