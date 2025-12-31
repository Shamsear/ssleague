/**
 * Check the footballplayers table schema
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_AUCTION_DB_URL || process.env.NEON_DATABASE_URL);

async function main() {
  console.log('🔍 Checking footballplayers table schema...\n');

  try {
    // Get table schema
    const schema = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'footballplayers'
      ORDER BY ordinal_position
    `;

    console.log('📋 footballplayers table columns:\n');
    console.log('═'.repeat(100));
    console.log('Column Name'.padEnd(30) + 'Data Type'.padEnd(25) + 'Nullable'.padEnd(15) + 'Default');
    console.log('═'.repeat(100));

    schema.forEach(col => {
      console.log(
        col.column_name.padEnd(30) +
        col.data_type.padEnd(25) +
        col.is_nullable.padEnd(15) +
        (col.column_default || 'NULL')
      );
    });

    console.log('═'.repeat(100));

    // Check a sample player to see what values are set
    console.log('\n📊 Sample player with team (to see what columns are populated):\n');
    const withTeam = await sql`
      SELECT *
      FROM footballplayers
      WHERE team_id IS NOT NULL
      LIMIT 1
    `;

    if (withTeam.length > 0) {
      console.log('Player with team:');
      Object.entries(withTeam[0]).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    }

    // Check a released player
    console.log('\n📊 Sample released player (team_id = NULL):\n');
    const released = await sql`
      SELECT *
      FROM footballplayers
      WHERE team_id IS NULL
      LIMIT 1
    `;

    if (released.length > 0) {
      console.log('Released player:');
      Object.entries(released[0]).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
