require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.NEON_DATABASE_URL);

async function addColumns() {
  console.log('\n📊 Adding contract season columns...\n');
  
  try {
    await sql`
      ALTER TABLE player_history 
      ADD COLUMN IF NOT EXISTS contract_start_season VARCHAR(50),
      ADD COLUMN IF NOT EXISTS contract_end_season VARCHAR(50)
    `;
    console.log('✅ Columns added');
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_player_history_contract_seasons 
      ON player_history(contract_start_season, contract_end_season)
    `;
    console.log('✅ Index created\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addColumns();
