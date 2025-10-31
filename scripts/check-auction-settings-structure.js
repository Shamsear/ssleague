require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function check() {
  const sql = neon(process.env.NEON_AUCTION_DB_URL || process.env.NEON_DATABASE_URL);
  
  try {
    const result = await sql`SELECT * FROM auction_settings LIMIT 1`;
    console.log('\n📋 Auction Settings Columns:');
    if (result.length > 0) {
      console.log(Object.keys(result[0]));
      console.log('\n Sample data:');
      console.log(result[0]);
    } else {
      console.log('No records found');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

check();
