/**
 * Check Star Ratings for Season 16 Players
 * Verifies if players have correct star ratings based on their base points
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

// Star rating ranges based on base points
const STAR_RANGES = [
  { min: 100, max: 119, expectedStar: 3, label: '3⭐' },
  { min: 120, max: 144, expectedStar: 4, label: '4⭐' },
  { min: 145, max: 169, expectedStar: 5, label: '5⭐' },
  { min: 170, max: 204, expectedStar: 6, label: '6⭐' },
  { min: 205, max: 249, expectedStar: 7, label: '7⭐' },
  { min: 250, max: 299, expectedStar: 8, label: '8⭐' },
  { min: 300, max: 399, expectedStar: 9, label: '9⭐' },
  { min: 400, max: 1000, expectedStar: 10, label: '10⭐' },
];

async function checkStarRatings() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

  console.log('🔍 Checking Star Ratings for Season 16 Players\n');
  console.log('=' .repeat(100));

  try {
    // Get all Season 16 players
    const players = await sql`
      SELECT 
        player_id,
        player_name,
        team,
        base_points,
        star_rating,
        points,
        category
      FROM player_seasons
      WHERE season_id = 'SSPSLS16'
      ORDER BY points DESC
    `;

    console.log(`\n📊 Total Players: ${players.length}\n`);

    // Group players by star range based on CURRENT POINTS
    const rangeResults = {};
    const mismatches = [];

    for (const range of STAR_RANGES) {
      const playersInRange = players.filter(
        p => p.points >= range.min && p.points <= range.max
      );

      rangeResults[range.label] = {
        range: `${range.min}-${range.max}`,
        expectedStar: range.expectedStar,
        players: playersInRange,
        correct: playersInRange.filter(p => p.star_rating === range.expectedStar),
        incorrect: playersInRange.filter(p => p.star_rating !== range.expectedStar),
      };

      // Track mismatches
      playersInRange.forEach(p => {
        if (p.star_rating !== range.expectedStar) {
          mismatches.push({
            ...p,
            expectedStar: range.expectedStar,
            range: range.label,
          });
        }
      });
    }

    // Display results by category
    console.log('\n📈 STAR RATING DISTRIBUTION (Based on Current Points)\n');
    console.log('=' .repeat(100));

    for (const range of STAR_RANGES) {
      const result = rangeResults[range.label];
      const total = result.players.length;
      const correct = result.correct.length;
      const incorrect = result.incorrect.length;
      const accuracy = total > 0 ? ((correct / total) * 100).toFixed(1) : '0.0';

      console.log(`\n${range.label} (Current Points: ${result.range})`);
      console.log('-'.repeat(100));
      console.log(`Total Players: ${total}`);
      console.log(`✅ Correct Star Rating: ${correct} (${accuracy}%)`);
      console.log(`❌ Incorrect Star Rating: ${incorrect}`);

      if (result.players.length > 0) {
        console.log('\nPlayers in this range:');
        result.players.forEach(p => {
          const status = p.star_rating === range.expectedStar ? '✅' : '❌';
          const starDiff = p.star_rating - range.expectedStar;
          const diffStr = starDiff > 0 ? `+${starDiff}` : starDiff;
          console.log(
            `  ${status} ${p.player_name.padEnd(30)} | Points: ${String(p.points).padStart(3)} | Base: ${String(p.base_points || 0).padStart(3)} | Star: ${p.star_rating}⭐ ${
              p.star_rating !== range.expectedStar ? `(Expected: ${range.expectedStar}⭐, Diff: ${diffStr})` : ''
            } | Team: ${p.team || 'Unassigned'}`
          );
        });
      }
    }

    // Summary of mismatches
    if (mismatches.length > 0) {
      console.log('\n\n⚠️  STAR RATING MISMATCHES\n');
      console.log('=' .repeat(100));
      console.log(`Total Mismatches: ${mismatches.length}\n`);

      mismatches.forEach((p, idx) => {
        const diff = p.star_rating - p.expectedStar;
        const diffStr = diff > 0 ? `+${diff}` : diff;
        console.log(`${idx + 1}. ${p.player_name}`);
        console.log(`   Current Points: ${p.points} (${p.range})`);
        console.log(`   Base Points: ${p.base_points || 0}`);
        console.log(`   Current Star: ${p.star_rating}⭐`);
        console.log(`   Expected Star: ${p.expectedStar}⭐`);
        console.log(`   Difference: ${diffStr} stars`);
        console.log(`   Team: ${p.team || 'Unassigned'}`);
        console.log('');
      });

      // Generate SQL to fix mismatches
      console.log('\n🔧 SQL TO FIX MISMATCHES:\n');
      console.log('=' .repeat(100));
      console.log('-- Copy and run this SQL to fix all star rating mismatches\n');
      
      mismatches.forEach(p => {
        console.log(
          `UPDATE player_seasons SET star_rating = ${p.expectedStar} WHERE player_id = '${p.player_id}' AND season_id = 'SSPSLS16'; -- ${p.player_name} (${p.points} pts)`
        );
      });
    } else {
      console.log('\n\n✅ ALL STAR RATINGS ARE CORRECT!\n');
      console.log('=' .repeat(100));
    }

    // Overall statistics
    console.log('\n\n📊 OVERALL STATISTICS\n');
    console.log('=' .repeat(100));
    const totalPlayers = players.length;
    const totalCorrect = totalPlayers - mismatches.length;
    const overallAccuracy = totalPlayers > 0 ? ((totalCorrect / totalPlayers) * 100).toFixed(1) : '0.0';

    console.log(`Total Players: ${totalPlayers}`);
    console.log(`Correct Star Ratings: ${totalCorrect} (${overallAccuracy}%)`);
    console.log(`Incorrect Star Ratings: ${mismatches.length} (${(100 - parseFloat(overallAccuracy)).toFixed(1)}%)`);

    // Category breakdown
    const legendPlayers = players.filter(p => p.category === 'Legend');
    const classicPlayers = players.filter(p => p.category === 'Classic');
    
    console.log(`\nLegend Players: ${legendPlayers.length}`);
    console.log(`Classic Players: ${classicPlayers.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the check
checkStarRatings()
  .then(() => {
    console.log('\n✅ Check completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
