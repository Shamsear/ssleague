/**
 * Check Tournament Database Tables
 * Lists all tables in the tournament database
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkTables() {
  const databaseUrl = process.env.NEON_TOURNAMENT_DB_URL;

  if (!databaseUrl) {
    console.error('❌ Error: NEON_TOURNAMENT_DB_URL not found');
    process.exit(1);
  }

  console.log('🔍 Checking tournament database tables...\n');

  const sql = neon(databaseUrl);

  try {
    // List all tables
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;

    console.log('📊 Tables in tournament database:');
    console.log('─'.repeat(50));
    tables.forEach((table, index) => {
      console.log(`${index + 1}. ${table.table_name}`);
    });
    console.log('─'.repeat(50));
    console.log(`\nTotal tables: ${tables.length}\n`);

    // Check if team_stats exists
    const teamStatsExists = tables.some(t => t.table_name === 'team_stats');
    console.log(`team_stats table exists: ${teamStatsExists ? '✅ YES' : '❌ NO'}`);

    // Check if seasons exists
    const seasonsExists = tables.some(t => t.table_name === 'seasons');
    console.log(`seasons table exists: ${seasonsExists ? '✅ YES' : '❌ NO'}`);

    // Check if tournaments exists
    const tournamentsExists = tables.some(t => t.table_name === 'tournaments');
    console.log(`tournaments table exists: ${tournamentsExists ? '✅ YES' : '❌ NO'}\n`);

    // If team_stats exists, show its columns
    if (teamStatsExists) {
      console.log('📋 team_stats columns:');
      const columns = await sql`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'team_stats'
        ORDER BY ordinal_position
      `;
      columns.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });
    }

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
}

checkTables().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
