/**
 * Check if football_spent column exists in teams table
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_AUCTION_DB_URL);

async function check() {
  console.log('🔍 Checking teams table schema...\n');

  try {
    const columns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'teams'
      ORDER BY ordinal_position
    `;

    console.log('📋 Teams table columns:\n');
    columns.forEach(col => {
      console.log(`   ${col.column_name.padEnd(30)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    const hasFootballSpent = columns.some(col => col.column_name === 'football_spent');

    console.log('\n' + '═'.repeat(80));
    if (hasFootballSpent) {
      console.log('✅ football_spent column EXISTS');
    } else {
      console.log('❌ football_spent column DOES NOT EXIST');
      console.log('\n💡 Need to add it? Run:');
      console.log('   ALTER TABLE teams ADD COLUMN football_spent NUMERIC(10,2) DEFAULT 0;');
    }
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error);
  }

  process.exit(0);
}

check();
