const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

async function testClear() {
  const sql = neon(process.env.NEON_DATABASE_URL);
  
  console.log('Testing Auction DB...');
  const count = await sql`SELECT COUNT(*) FROM footballplayers`;
  console.log('Footballplayers count:', count);
  
  console.log('\nTrying delete...');
  const deleteResult = await sql`DELETE FROM footballplayers`;
  console.log('Delete result:', deleteResult);
  
  console.log('\nChecking count after delete...');
  const countAfter = await sql`SELECT COUNT(*) FROM footballplayers`;
  console.log('Footballplayers count after:', countAfter);
}

testClear().catch(console.error);
