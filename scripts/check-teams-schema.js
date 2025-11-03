const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_DATABASE_URL);

async function checkTeamsSchema() {
  try {
    console.log('📋 Checking teams table schema...\n');
    
    const columns = await sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'teams'
      ORDER BY ordinal_position
    `;
    
    console.log('Columns in teams table:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}) ${col.column_default ? `[default: ${col.column_default}]` : ''}`);
    });
    
    console.log(`\nTotal columns: ${columns.length}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkTeamsSchema();
