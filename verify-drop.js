// Verify which tables actually exist
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

async function verifyTables() {
  try {
    console.log('Verifying tables in database...\n');
    
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    
    console.log(`Found ${tables.length} tables:\n`);
    
    const expectedTables = ['rounds', 'bids', 'team_players', 'footballplayers', 'starred_players', 'auction_settings'];
    const unexpectedTables = ['auction_rounds', 'round_players', 'round_bids', 'teams'];
    
    tables.forEach(t => {
      if (expectedTables.includes(t.table_name)) {
        console.log(`✅ ${t.table_name} (EXPECTED)`);
      } else if (unexpectedTables.includes(t.table_name)) {
        console.log(`❌ ${t.table_name} (SHOULD BE DROPPED)`);
      } else {
        console.log(`❓ ${t.table_name} (UNKNOWN)`);
      }
    });
    
    console.log('\n---\n');
    
    const shouldBeDropped = tables.filter(t => unexpectedTables.includes(t.table_name));
    if (shouldBeDropped.length > 0) {
      console.log('⚠️  WARNING: These tables should have been dropped:');
      shouldBeDropped.forEach(t => console.log(`   - ${t.table_name}`));
      console.log('\nThey may be protected by constraints or recreated by the app.');
    } else {
      console.log('✅ All unwanted tables have been successfully removed!');
    }
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

verifyTables();
