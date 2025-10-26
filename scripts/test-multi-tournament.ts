/**
 * Test Script: Multi-Tournament Architecture
 * 
 * This script tests the multi-tournament implementation by:
 * 1. Creating multiple tournaments for a season
 * 2. Testing CRUD operations
 * 3. Verifying backward compatibility
 */

import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const BASE_URL = 'http://localhost:3000';
const TEST_SEASON_ID = 'SSPSLS16';

async function runTests() {
  console.log('🧪 Starting Multi-Tournament Tests\n');
  console.log('===================================\n');

  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: Get existing tournaments
  console.log('📊 Test 1: Get tournaments for season');
  try {
    const response = await fetch(`${BASE_URL}/api/tournaments?season_id=${TEST_SEASON_ID}`);
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log(`✅ PASS - Found ${data.tournaments?.length || 0} tournaments`);
      if (data.tournaments && data.tournaments.length > 0) {
        data.tournaments.forEach((t: any) => {
          console.log(`   - ${t.id}: ${t.tournament_name} (${t.status})`);
        });
      }
      testsPassed++;
    } else {
      console.log(`❌ FAIL - ${data.error}`);
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ FAIL - ${error}`);
    testsFailed++;
  }
  console.log('');

  // Test 2: Create a Cup tournament
  console.log('📊 Test 2: Create Cup tournament');
  try {
    const response = await fetch(`${BASE_URL}/api/tournaments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        season_id: TEST_SEASON_ID,
        tournament_type: 'cup',
        tournament_name: `${TEST_SEASON_ID} FA Cup`,
        tournament_code: 'FAC',
        status: 'upcoming',
        is_primary: false,
        display_order: 2,
      }),
    });
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log(`✅ PASS - Created ${data.tournament.id}`);
      testsPassed++;
    } else {
      console.log(`❌ FAIL - ${data.error}`);
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ FAIL - ${error}`);
    testsFailed++;
  }
  console.log('');

  // Test 3: Get player stats (backward compatibility with seasonId)
  console.log('📊 Test 3: Get player stats with seasonId (backward compat)');
  try {
    const response = await fetch(`${BASE_URL}/api/stats/players?seasonId=${TEST_SEASON_ID}&limit=5`);
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log(`✅ PASS - Retrieved ${data.count} player stats`);
      testsPassed++;
    } else {
      console.log(`❌ FAIL - ${data.error}`);
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ FAIL - ${error}`);
    testsFailed++;
  }
  console.log('');

  // Test 4: Get player stats with tournamentId
  console.log('📊 Test 4: Get player stats with tournamentId');
  try {
    const tournamentId = `${TEST_SEASON_ID}-LEAGUE`;
    const response = await fetch(`${BASE_URL}/api/stats/players?tournamentId=${tournamentId}&limit=5`);
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log(`✅ PASS - Retrieved ${data.count} player stats for ${tournamentId}`);
      testsPassed++;
    } else {
      console.log(`❌ FAIL - ${data.error}`);
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ FAIL - ${error}`);
    testsFailed++;
  }
  console.log('');

  // Test 5: Get team stats (backward compatibility)
  console.log('📊 Test 5: Get team stats with seasonId (backward compat)');
  try {
    const response = await fetch(`${BASE_URL}/api/stats/teams?seasonId=${TEST_SEASON_ID}`);
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log(`✅ PASS - Retrieved ${data.count} team stats`);
      testsPassed++;
    } else {
      console.log(`❌ FAIL - ${data.error}`);
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ FAIL - ${error}`);
    testsFailed++;
  }
  console.log('');

  // Test 6: Get fixtures with tournamentId
  console.log('📊 Test 6: Get fixtures with tournamentId');
  try {
    const tournamentId = `${TEST_SEASON_ID}-LEAGUE`;
    const response = await fetch(`${BASE_URL}/api/fixtures/season?tournament_id=${tournamentId}`);
    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ PASS - Retrieved ${data.fixtures?.length || 0} fixtures`);
      testsPassed++;
    } else {
      console.log(`❌ FAIL - ${data.error}`);
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ FAIL - ${error}`);
    testsFailed++;
  }
  console.log('');

  // Test 7: Get tournament settings
  console.log('📊 Test 7: Get tournament settings');
  try {
    const tournamentId = `${TEST_SEASON_ID}-LEAGUE`;
    const response = await fetch(`${BASE_URL}/api/tournament-settings?tournament_id=${tournamentId}`);
    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ PASS - Retrieved settings for ${tournamentId}`);
      testsPassed++;
    } else {
      console.log(`❌ FAIL - ${data.error}`);
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ FAIL - ${error}`);
    testsFailed++;
  }
  console.log('');

  // Summary
  console.log('===================================');
  console.log('📊 Test Summary');
  console.log('===================================');
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`📈 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%\n`);

  if (testsFailed === 0) {
    console.log('🎉 All tests passed! Multi-tournament implementation is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Please review the errors above.');
  }
}

// Run tests
console.log('⚠️  Make sure your dev server is running on http://localhost:3000\n');
runTests()
  .then(() => {
    console.log('\n✅ Tests complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test suite failed:', error);
    process.exit(1);
  });
