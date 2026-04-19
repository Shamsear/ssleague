require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.NEON_DATABASE_URL);

async function verifySchema() {
  const columns = await sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'player_history'
    ORDER BY ordinal_position
  `;

  console.log('\nplayer_history table columns:\n');
  columns.forEach(col => {
    console.log(`  ${col.column_name.padEnd(25)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
  });

  process.exit(0);
}

verifySchema().catch(e => {
  console.error(e);
  process.exit(1);
});
