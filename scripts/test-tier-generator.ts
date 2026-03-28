/**
 * Manual test script for tier generator
 * Run with: npx tsx scripts/test-tier-generator.ts
 */

import type { Player } from '../lib/fantasy/tier-generator';

// Mock implementation for testing without database
function sortPlayersByPoints(players: Player[]): Player[] {
  return [...players].sort((a, b) => {
    if (b.total_points !== a.total_points) {
      return b.total_points - a.total_points;
    }
    if (b.avg_points_per_game !== a.avg_points_per_game) {
      return b.avg_points_per_game - a.avg_points_per_game;
    }
    return a.player_name.localeCompare(b.player_name);
  });
}

function dividePlayersIntoTiers(
  sortedPlayers: Player[],
  numberOfTiers: number
): any[] {
  const totalPlayers = sortedPlayers.length;
  const basePlayersPerTier = Math.floor(totalPlayers / numberOfTiers);
  const remainder = totalPlayers % numberOfTiers;

  const tiers: any[] = [];
  let currentIndex = 0;

  for (let tierNumber = 1; tierNumber <= numberOfTiers; tierNumber++) {
    const playersInThisTier = basePlayersPerTier + (tierNumber <= remainder ? 1 : 0);
    const tierPlayers = sortedPlayers.slice(currentIndex, currentIndex + playersInThisTier);
    
    const points = tierPlayers.map(p => p.total_points);
    const min = Math.min(...points);
    const max = Math.max(...points);
    const sum = points.reduce((acc, p) => acc + p, 0);
    const avg = Math.round((sum / tierPlayers.length) * 100) / 100;

    tiers.push({
      tier_number: tierNumber,
      player_count: tierPlayers.length,
      min_points: min,
      max_points: max,
      avg_points: avg,
      players: tierPlayers
    });
    
    currentIndex += playersInThisTier;
  }

  return tiers;
}

// Test 1: 300 players into 7 tiers
console.log('Test 1: 300 players into 7 tiers');
console.log('=====================================');

const players300: Player[] = Array.from({ length: 300 }, (_, i) => ({
  real_player_id: `player_${i + 1}`,
  player_name: `Player ${i + 1}`,
  position: 'FW',
  real_team_name: 'Team A',
  total_points: 300 - i,
  games_played: 10,
  avg_points_per_game: (300 - i) / 10
}));

const sorted300 = sortPlayersByPoints(players300);
const tiers7 = dividePlayersIntoTiers(sorted300, 7);

console.log(`Total players: ${players300.length}`);
console.log(`Number of tiers: ${tiers7.length}`);
console.log('');

tiers7.forEach(tier => {
  console.log(`Tier ${tier.tier_number}: ${tier.player_count} players, ${tier.min_points}-${tier.max_points} pts (avg: ${tier.avg_points})`);
});

const total = tiers7.reduce((sum, tier) => sum + tier.player_count, 0);
console.log(`\nTotal players in tiers: ${total}`);
console.log(`✅ Test 1 ${total === 300 ? 'PASSED' : 'FAILED'}`);

// Test 2: Uneven distribution (10 players into 3 tiers)
console.log('\n\nTest 2: 10 players into 3 tiers (uneven)');
console.log('=====================================');

const players10: Player[] = Array.from({ length: 10 }, (_, i) => ({
  real_player_id: `player_${i + 1}`,
  player_name: `Player ${i + 1}`,
  position: 'FW',
  real_team_name: 'Team A',
  total_points: 10 - i,
  games_played: 5,
  avg_points_per_game: (10 - i) / 5
}));

const sorted10 = sortPlayersByPoints(players10);
const tiers3 = dividePlayersIntoTiers(sorted10, 3);

tiers3.forEach(tier => {
  console.log(`Tier ${tier.tier_number}: ${tier.player_count} players`);
});

const total2 = tiers3.reduce((sum, tier) => sum + tier.player_count, 0);
console.log(`\nTotal players in tiers: ${total2}`);
console.log(`✅ Test 2 ${total2 === 10 ? 'PASSED' : 'FAILED'}`);

// Test 3: Tier stats calculation
console.log('\n\nTest 3: Tier stats calculation');
console.log('=====================================');

const players5: Player[] = [
  { real_player_id: 'p1', player_name: 'Player 1', position: 'FW', real_team_name: 'Team A', total_points: 100, games_played: 10, avg_points_per_game: 10 },
  { real_player_id: 'p2', player_name: 'Player 2', position: 'MF', real_team_name: 'Team B', total_points: 90, games_played: 10, avg_points_per_game: 9 },
  { real_player_id: 'p3', player_name: 'Player 3', position: 'DF', real_team_name: 'Team C', total_points: 80, games_played: 10, avg_points_per_game: 8 },
  { real_player_id: 'p4', player_name: 'Player 4', position: 'GK', real_team_name: 'Team D', total_points: 70, games_played: 10, avg_points_per_game: 7 },
  { real_player_id: 'p5', player_name: 'Player 5', position: 'FW', real_team_name: 'Team E', total_points: 60, games_played: 10, avg_points_per_game: 6 }
];

const sorted5 = sortPlayersByPoints(players5);
const tiers2 = dividePlayersIntoTiers(sorted5, 2);

console.log(`Tier 1: min=${tiers2[0].min_points}, max=${tiers2[0].max_points}, avg=${tiers2[0].avg_points}`);
console.log(`Expected: min=80, max=100, avg=90`);
console.log(`✅ Tier 1 ${tiers2[0].min_points === 80 && tiers2[0].max_points === 100 && tiers2[0].avg_points === 90 ? 'PASSED' : 'FAILED'}`);

console.log(`\nTier 2: min=${tiers2[1].min_points}, max=${tiers2[1].max_points}, avg=${tiers2[1].avg_points}`);
console.log(`Expected: min=60, max=70, avg=65`);
console.log(`✅ Tier 2 ${tiers2[1].min_points === 60 && tiers2[1].max_points === 70 && tiers2[1].avg_points === 65 ? 'PASSED' : 'FAILED'}`);

// Test 4: Performance test (350 players)
console.log('\n\nTest 4: Performance test (350 players)');
console.log('=====================================');

const players350: Player[] = Array.from({ length: 350 }, (_, i) => ({
  real_player_id: `player_${i + 1}`,
  player_name: `Player ${i + 1}`,
  position: 'FW',
  real_team_name: 'Team A',
  total_points: 350 - i,
  games_played: 10,
  avg_points_per_game: (350 - i) / 10
}));

const startTime = Date.now();
const sorted350 = sortPlayersByPoints(players350);
const tiers350 = dividePlayersIntoTiers(sorted350, 7);
const endTime = Date.now();
const duration = endTime - startTime;

console.log(`Processing time: ${duration}ms`);
console.log(`✅ Performance ${duration < 2000 ? 'PASSED' : 'FAILED'} (should be < 2000ms)`);

// Test 5: Sorting verification
console.log('\n\nTest 5: Sorting verification');
console.log('=====================================');

const unsortedPlayers: Player[] = [
  { real_player_id: 'p1', player_name: 'Player 1', position: 'FW', real_team_name: 'Team A', total_points: 50, games_played: 10, avg_points_per_game: 5 },
  { real_player_id: 'p2', player_name: 'Player 2', position: 'MF', real_team_name: 'Team B', total_points: 100, games_played: 10, avg_points_per_game: 10 },
  { real_player_id: 'p3', player_name: 'Player 3', position: 'DF', real_team_name: 'Team C', total_points: 75, games_played: 10, avg_points_per_game: 7.5 }
];

const sortedPlayers = sortPlayersByPoints(unsortedPlayers);

console.log('Sorted order:');
sortedPlayers.forEach((p, i) => {
  console.log(`  ${i + 1}. ${p.player_name} (${p.total_points} pts)`);
});

const correctOrder = sortedPlayers[0].real_player_id === 'p2' && 
                     sortedPlayers[1].real_player_id === 'p3' && 
                     sortedPlayers[2].real_player_id === 'p1';

console.log(`✅ Sorting ${correctOrder ? 'PASSED' : 'FAILED'}`);

console.log('\n\n=== ALL TESTS COMPLETE ===');
