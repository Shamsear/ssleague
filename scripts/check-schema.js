require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const db = neon(process.env.FANTASY_DATABASE_URL);

async function checkSchema() {
  // Check fantasy_transfers columns
  const transferCols = await db`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'fantasy_transfers'
    ORDER BY ordinal_position
  `;
  
  console.log('=== FANTASY_TRANSFERS COLUMNS ===');
  console.log(JSON.stringify(transferCols, null, 2));
  
  // Sample transfer record
  const sampleTransfer = await db`
    SELECT * FROM fantasy_transfers LIMIT 1
  `;
  
  console.log('\n=== SAMPLE TRANSFER ===');
  console.log(JSON.stringify(sampleTransfer, null, 2));
}

checkSchema().catch(console.error);
