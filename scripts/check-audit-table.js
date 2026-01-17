const { neon } = require('@neondatabase/serverless');
const dotenv = require('dotenv');
const path = require('path');

// Load .env.local file
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function checkAuditTable() {
  try {
    const connectionString = process.env.NEON_TOURNAMENT_DB_URL;

    if (!connectionString) {
      throw new Error('NEON_TOURNAMENT_DB_URL not found in environment');
    }

    console.log('🔌 Connecting to database...\n');
    const sql = neon(connectionString);

    // Check if table exists
    console.log('📋 Checking if fixture_audit_log table exists...');
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'fixture_audit_log'
      );
    `;
    console.log('Table exists:', tableExists[0].exists);
    console.log('');

    if (tableExists[0].exists) {
      // Get table structure
      console.log('📊 Table structure:');
      const columns = await sql`
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_name = 'fixture_audit_log'
        ORDER BY ordinal_position;
      `;

      columns.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });
      console.log('');

      // Get row count
      const count = await sql`SELECT COUNT(*) as count FROM fixture_audit_log`;
      console.log(`📈 Total rows: ${count[0].count}`);
    } else {
      console.log('❌ Table does not exist!');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

checkAuditTable();
