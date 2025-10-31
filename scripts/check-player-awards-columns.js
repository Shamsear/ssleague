const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_DATABASE_URL);

async function checkColumns() {
  try {
    const result = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'player_awards'
      ORDER BY ordinal_position
    `;

    console.log('\n📋 player_awards table columns:\n');
    result.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
    });
    console.log('');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkColumns();
