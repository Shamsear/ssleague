/**
 * Test API Routes
 * Verifies all new API routes are working
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const BASE_URL = 'http://localhost:3000';
const TEST_SEASON_ID = 'test_season_1';

async function testAPI() {
  console.log('🧪 Testing API Routes\n');
  console.log('='.repeat(80) + '\n');
  
  let passed = 0;
  let failed = 0;
  
  // Helper function
  async function testEndpoint(name: string, url: string, method: string = 'GET', body?: any) {
    try {
      const options: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' }
      };
      
      if (body) {
        options.body = JSON.stringify(body);
      }
      
      const response = await fetch(url, options);
      const data = await response.json();
      
      if (data.success !== false && response.ok) {
        console.log(`✅ ${name}`);
        passed++;
        return data;
      } else {
        console.log(`❌ ${name}: ${data.error || 'Unknown error'}`);
        failed++;
        return null;
      }
    } catch (error: any) {
      console.log(`❌ ${name}: ${error.message}`);
      failed++;
      return null;
    }
  }
  
  console.log('📦 Auction API Routes:\n');
  
  await testEndpoint(
    'GET /api/auction/footballplayers',
    `${BASE_URL}/api/auction/footballplayers?seasonId=${TEST_SEASON_ID}`
  );
  
  await testEndpoint(
    'GET /api/auction/rounds',
    `${BASE_URL}/api/auction/rounds?seasonId=${TEST_SEASON_ID}`
  );
  
  await testEndpoint(
    'GET /api/auction/bids',
    `${BASE_URL}/api/auction/bids`
  );
  
  console.log('\n⚽ Tournament API Routes:\n');
  
  await testEndpoint(
    'GET /api/tournament/fixtures',
    `${BASE_URL}/api/tournament/fixtures?seasonId=${TEST_SEASON_ID}`
  );
  
  await testEndpoint(
    'GET /api/tournament/matches',
    `${BASE_URL}/api/tournament/matches?seasonId=${TEST_SEASON_ID}`
  );
  
  console.log('\n📊 Stats API Routes:\n');
  
  await testEndpoint(
    'GET /api/stats/players',
    `${BASE_URL}/api/stats/players?seasonId=${TEST_SEASON_ID}`
  );
  
  await testEndpoint(
    'GET /api/stats/teams',
    `${BASE_URL}/api/stats/teams?seasonId=${TEST_SEASON_ID}`
  );
  
  await testEndpoint(
    'GET /api/stats/leaderboard',
    `${BASE_URL}/api/stats/leaderboard?seasonId=${TEST_SEASON_ID}&type=player`
  );
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log(`\n✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Total: ${passed + failed}\n`);
  
  if (failed === 0) {
    console.log('🎉 All API routes are working!\n');
  } else {
    console.log('⚠️  Some API routes failed. Check the errors above.\n');
    console.log('Make sure:');
    console.log('1. Development server is running (npm run dev)');
    console.log('2. Database connections are configured');
    console.log('3. Tables exist in both databases\n');
  }
}

// Check if server is running
async function checkServer() {
  try {
    const response = await fetch(BASE_URL);
    return response.ok || response.status === 404; // 404 is fine, means server is running
  } catch {
    return false;
  }
}

async function run() {
  console.log('Checking if development server is running...\n');
  
  const serverRunning = await checkServer();
  
  if (!serverRunning) {
    console.log('❌ Development server is not running!');
    console.log('\nPlease start the server first:');
    console.log('  npm run dev\n');
    console.log('Then run this test again:');
    console.log('  npx tsx scripts/test-api-routes.ts\n');
    process.exit(1);
  }
  
  console.log('✅ Server is running\n');
  await testAPI();
}

run();
