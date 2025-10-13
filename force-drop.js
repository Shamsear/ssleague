// Force drop unused tables
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

async function forceDrop() {
  try {
    console.log('🗑️  Force dropping unused tables...\n');
    
    const tablesToDrop = ['auction_rounds', 'round_players', 'round_bids', 'teams'];
    
    for (const table of tablesToDrop) {
      console.log(`Attempting to drop ${table}...`);
      
      try {
        // First, check if table exists
        const exists = await sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = ${table}
          )
        `;
        
        if (exists[0].exists) {
          // Drop with CASCADE to remove all dependencies
          await sql.unsafe(`DROP TABLE "${table}" CASCADE`);
          console.log(`✅ Successfully dropped ${table}\n`);
        } else {
          console.log(`ℹ️  ${table} does not exist\n`);
        }
      } catch (err) {
        console.log(`❌ Error: ${err.message}\n`);
      }
    }
    
    // Verify
    console.log('---\nVerifying remaining tables:\n');
    const remainingTables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    
    remainingTables.forEach(t => {
      if (tablesToDrop.includes(t.table_name)) {
        console.log(`❌ ${t.table_name} (STILL EXISTS - FAILED TO DROP)`);
      } else {
        console.log(`✅ ${t.table_name}`);
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

forceDrop();
