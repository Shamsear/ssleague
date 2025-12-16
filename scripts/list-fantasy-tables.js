/**
 * List all tables in the fantasy database
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function listTables() {
  const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);

  console.log('Tables in fantasy database:');
  
  const tables = await fantasyDb`
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;

  tables.forEach(table => {
    console.log(`- ${table.tablename}`);
  });
}

listTables()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
