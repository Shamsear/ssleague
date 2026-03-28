/**
 * Test tier generator with real player data from database
 * Run with: npx tsx scripts/test-tier-generator-real-data.ts
 */

import { generateDraftTiers, saveTiersToDatabase, getTiersFromDatabase, deleteTiersFromDatabase } from '../lib/fantasy/tier-generator';

async function testWithRealData() {
  console.log('🎯 Testing Tier Generator with Real Player Data');
  console.log('================================================\n');

  try {
    // Test league ID (replace with actual league ID from your database)
    const testLeagueId = 'test_league_tier_gen';
    
    console.log('Step 1: Generating tiers...');
    const startTime = Date.now();
    
    const tiers = await generateDraftTiers({
      leagueId: testLeagueId,
      numberOfTiers: 7,
      draftType: 'initial',
      minGamesPlayed: 1
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`\n✅ Generated ${tiers.length} tiers in ${duration}ms`);
    console.log('\nTier Summary:');
    console.log('=============');
    
    let totalPlayers = 0;
    tiers.forEach(tier => {
      console.log(`Tier ${tier.tier_number} (${tier.tier_name}):`);
      console.log(`  Players: ${tier.player_count}`);
      console.log(`  Points Range: ${tier.min_points} - ${tier.max_points}`);
      console.log(`  Average Points: ${tier.avg_points}`);
      console.log(`  Top 3 Players:`);
      
      tier.players.slice(0, 3).forEach((player, i) => {
        console.log(`    ${i + 1}. ${player.player_name} (${player.total_points} pts)`);
      });
      console.log('');
      
      totalPlayers += tier.player_count;
    });
    
    console.log(`Total Players: ${totalPlayers}`);
    console.log(`Performance: ${duration < 2000 ? '✅ PASSED' : '❌ FAILED'} (${duration}ms < 2000ms)`);
    
    // Test saving to database
    console.log('\n\nStep 2: Saving tiers to database...');
    await saveTiersToDatabase(testLeagueId, tiers, 'initial');
    console.log('✅ Tiers saved successfully');
    
    // Test retrieving from database
    console.log('\n\nStep 3: Retrieving tiers from database...');
    const retrievedTiers = await getTiersFromDatabase(testLeagueId, 'initial');
    console.log(`✅ Retrieved ${retrievedTiers.length} tiers`);
    
    // Verify data integrity
    console.log('\n\nStep 4: Verifying data integrity...');
    let integrityPassed = true;
    
    for (let i = 0; i < tiers.length; i++) {
      const original = tiers[i];
      const retrieved = retrievedTiers[i];
      
      if (original.tier_number !== retrieved.tier_number) {
        console.log(`❌ Tier number mismatch: ${original.tier_number} !== ${retrieved.tier_number}`);
        integrityPassed = false;
      }
      
      if (original.player_count !== retrieved.player_count) {
        console.log(`❌ Player count mismatch: ${original.player_count} !== ${retrieved.player_count}`);
        integrityPassed = false;
      }
      
      if (original.min_points !== retrieved.min_points) {
        console.log(`❌ Min points mismatch: ${original.min_points} !== ${retrieved.min_points}`);
        integrityPassed = false;
      }
    }
    
    if (integrityPassed) {
      console.log('✅ Data integrity verified');
    }
    
    // Cleanup
    console.log('\n\nStep 5: Cleaning up test data...');
    await deleteTiersFromDatabase(testLeagueId, 'initial');
    console.log('✅ Test data cleaned up');
    
    console.log('\n\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the test
testWithRealData();
