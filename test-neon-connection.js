// Quick test script to check Neon database connectivity
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function testConnection() {
  console.log('Testing Neon Tournament DB connection...');
  console.log('URL:', process.env.NEON_TOURNAMENT_DB_URL?.substring(0, 50) + '...');
  
  try {
    const sql = neon(process.env.NEON_TOURNAMENT_DB_URL, {
      fetchConnectionTimeout: 30000,
      connectionTimeout: 30000,
    });
    
    console.log('Executing test query...');
    const result = await sql`SELECT NOW() as current_time, version() as db_version`;
    
    console.log('✅ Connection successful!');
    console.log('Database time:', result[0].current_time);
    console.log('Database version:', result[0].db_version);
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('Full error:', error);
  }
}

testConnection();
