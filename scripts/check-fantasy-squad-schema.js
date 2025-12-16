/**
 * Check fantasy_squad table schema
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkSchema() {
  const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);

  console.log('fantasy_squad table schema:\n');
  
  const columns = await fantasyDb`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_name = 'fantasy_squad'
    ORDER BY ordinal_position
  `;

  columns.forEach(col => {
    console.log(`  ${col.column_name.padEnd(30)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
  });
}

checkSchema()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
