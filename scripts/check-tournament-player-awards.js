const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const TOURNAMENT_DB_URL = 'postgresql://neondb_owner:npg_2imTobxgU1HM@ep-twilight-union-a1ee67rr-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(TOURNAMENT_DB_URL);

async function checkColumns() {
  try {
    // First, check what tables exist
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    console.log('\n📋 All tables in database:\n');
    tables.forEach(t => console.log(`  - ${t.table_name}`));
    console.log('');

    // Then check player_awards columns if it exists
    const result = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'player_awards'
      ORDER BY ordinal_position
    `;

    console.log('\n📋 player_awards table columns:\n');
    if (result.length === 0) {
      console.log('  ❌ Table does not exist or has no columns\n');
    } else {
      result.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
      });
      console.log('');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkColumns();
