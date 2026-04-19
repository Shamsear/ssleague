/**
 * Check all tables in database
 */

require('dotenv').config({ path: '.env.local' });

const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.NEON_DATABASE_URL);

async function checkTables() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║              ALL TABLES IN DATABASE                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    
    console.log(`Found ${tables.length} tables:\n`);
    
    tables.forEach((t, i) => {
      console.log(`${i + 1}. ${t.table_name}`);
    });
    
    console.log('');

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  }
}

checkTables()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
