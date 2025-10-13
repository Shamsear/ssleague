// List all tables in Neon database
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

async function listTables() {
  try {
    console.log('Listing all tables in Neon database...\n');
    
    // Get all tables
    const tables = await sql`
      SELECT 
        table_name,
        (SELECT COUNT(*) 
         FROM information_schema.columns 
         WHERE columns.table_name = tables.table_name) as column_count
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    
    console.log(`Found ${tables.length} tables:\n`);
    
    for (const table of tables) {
      console.log(`📋 ${table.table_name} (${table.column_count} columns)`);
      
      // Get row count
      try {
        const countQuery = `SELECT COUNT(*) as count FROM "${table.table_name}"`;
        const countResult = await sql.unsafe(countQuery);
        console.log(`   Rows: ${countResult[0].count}`);
      } catch (err) {
        console.log(`   Rows: Error - ${err.message}`);
      }
      console.log('');
    }
    
    // List views
    console.log('\n---\nViews:\n');
    const views = await sql`
      SELECT table_name
      FROM information_schema.views
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    
    views.forEach(view => {
      console.log(`📊 ${view.table_name} (view)`);
    });
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

listTables();
