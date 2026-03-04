/**
 * Test Neon Database Connection
 * 
 * This script tests the connection to the Neon Tournament database
 * to verify network connectivity and database availability.
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

async function testConnection() {
  console.log('🔍 Testing Neon Tournament Database Connection...\n');

  const connectionString = process.env.NEON_TOURNAMENT_DB_URL;

  if (!connectionString) {
    console.error('❌ NEON_TOURNAMENT_DB_URL not found in environment variables');
    process.exit(1);
  }

  console.log('✅ Connection string found');
  console.log(`   Host: ${connectionString.match(/@([^/]+)/)?.[1] || 'unknown'}\n`);

  try {
    const sql = neon(connectionString, {
      fetchConnectionTimeout: 30000,
      connectionTimeout: 30000,
    });

    console.log('📊 Testing query execution...');
    
    // Test 1: Simple query
    const result = await sql`SELECT NOW() as current_time, version() as db_version`;
    console.log('✅ Database connection successful!');
    console.log(`   Current time: ${result[0].current_time}`);
    console.log(`   Database: ${result[0].db_version.split(' ')[0]}\n`);

    // Test 2: Check for seasons
    console.log('📊 Checking for seasons...');
    const seasons = await sql`
      SELECT DISTINCT season_id, COUNT(*) as tournament_count
      FROM tournaments
      GROUP BY season_id
      ORDER BY season_id DESC
    `;
    
    if (seasons.length > 0) {
      console.log(`✅ Found ${seasons.length} seasons:`);
      seasons.forEach(s => {
        console.log(`   - ${s.season_id} (${s.tournament_count} tournaments)`);
      });
    } else {
      console.log('⚠️  No seasons found in tournaments table');
    }

    console.log('\n✅ All tests passed! Database is ready.');

  } catch (error) {
    console.error('\n❌ Connection test failed:');
    console.error(`   Error: ${error.message}`);
    
    if (error.code) {
      console.error(`   Code: ${error.code}`);
    }
    
    if (error.message.includes('ENOTFOUND')) {
      console.error('\n💡 DNS resolution failed. Possible causes:');
      console.error('   - No internet connection');
      console.error('   - Firewall blocking Neon database');
      console.error('   - VPN or proxy issues');
      console.error('   - DNS server problems');
    }
    
    process.exit(1);
  }
}

testConnection();
