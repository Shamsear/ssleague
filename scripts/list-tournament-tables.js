const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

async function listTables() {
  try {
    console.log('🔍 Listing all tables in tournament database...\n');

    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    console.log('📋 Available tables:');
    tables.forEach((table, index) => {
      console.log(`${index + 1}. ${table.table_name}`);
    });

    console.log(`\n✅ Total: ${tables.length} tables`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

listTables();
