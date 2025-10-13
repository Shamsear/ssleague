// Drop unused tables from Neon database
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

async function dropUnusedTables() {
  try {
    const tablesToDrop = [
      'auction_rounds',   // Old schema, replaced by 'rounds'
      'round_players',    // Old schema, replaced by 'bids'
      'round_bids',       // Duplicate/old schema
      'teams'             // Teams are in Firebase, not needed in Neon
    ];
    
    console.log('🗑️  Dropping unused tables from Neon database...\n');
    console.log('Tables to drop:');
    tablesToDrop.forEach(t => console.log(`  - ${t}`));
    console.log('\nTables to keep:');
    console.log('  ✓ rounds');
    console.log('  ✓ bids');
    console.log('  ✓ team_players');
    console.log('  ✓ footballplayers');
    console.log('  ✓ starred_players');
    console.log('  ✓ auction_settings (for auction configuration)');
    console.log('');
    
    for (const table of tablesToDrop) {
      try {
        console.log(`Dropping ${table}...`);
        await sql.unsafe(`DROP TABLE IF EXISTS ${table} CASCADE`);
        console.log(`✅ ${table} dropped\n`);
      } catch (err) {
        console.log(`❌ Error dropping ${table}: ${err.message}\n`);
      }
    }
    
    console.log('Done! Remaining tables:');
    const remainingTables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    
    remainingTables.forEach(t => console.log(`  ✓ ${t.table_name}`));
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

dropUnusedTables();
