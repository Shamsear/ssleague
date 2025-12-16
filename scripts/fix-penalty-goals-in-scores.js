/**
 * Script to fix fixture scores by adding penalty goals to the final scores
 * This corrects fixtures where penalty goals were recorded but not added to the score
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function fixPenaltyGoals() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

  console.log('🔧 Fixing penalty goals in fixture scores...\n');

  try {
    // Get all completed fixtures with penalty goals
    const fixtures = await sql`
      SELECT 
        id,
        home_team_id,
        home_team_name,
        away_team_id,
        away_team_name,
        home_score,
        away_score,
        home_penalty_goals,
        away_penalty_goals,
        result,
        season_id,
        round_number
      FROM fixtures
      WHERE status = 'completed'
        AND (home_penalty_goals > 0 OR away_penalty_goals > 0)
      ORDER BY season_id, round_number
    `;

    console.log(`📋 Found ${fixtures.length} fixtures with penalty goals\n`);

    if (fixtures.length === 0) {
      console.log('✅ No fixtures need fixing');
      return;
    }

    let fixedCount = 0;

    for (const fixture of fixtures) {
      const homePenalty = fixture.home_penalty_goals || 0;
      const awayPenalty = fixture.away_penalty_goals || 0;
      
      // Calculate what the scores should be (current score + penalty goals)
      const newHomeScore = fixture.home_score + homePenalty;
      const newAwayScore = fixture.away_score + awayPenalty;
      
      // Determine new result
      let newResult;
      if (newHomeScore > newAwayScore) {
        newResult = 'home_win';
      } else if (newAwayScore > newHomeScore) {
        newResult = 'away_win';
      } else {
        newResult = 'draw';
      }

      // Check if this needs fixing
      const needsFix = (
        fixture.home_score !== newHomeScore ||
        fixture.away_score !== newAwayScore ||
        fixture.result !== newResult
      );

      if (needsFix) {
        console.log(`🔧 Fixing: ${fixture.home_team_name} vs ${fixture.away_team_name}`);
        console.log(`   Old: ${fixture.home_score}-${fixture.away_score} (${fixture.result})`);
        console.log(`   New: ${newHomeScore}-${newAwayScore} (${newResult})`);
        console.log(`   Penalties: Home +${homePenalty}, Away +${awayPenalty}`);

        // Update the fixture
        await sql`
          UPDATE fixtures
          SET
            home_score = ${newHomeScore},
            away_score = ${newAwayScore},
            result = ${newResult},
            updated_at = NOW()
          WHERE id = ${fixture.id}
        `;

        fixedCount++;
        console.log(`   ✅ Fixed!\n`);
      } else {
        console.log(`✓ ${fixture.home_team_name} vs ${fixture.away_team_name}: Already correct (${fixture.home_score}-${fixture.away_score})\n`);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Total fixtures checked: ${fixtures.length}`);
    console.log(`   Fixtures fixed: ${fixedCount}`);
    console.log(`   Already correct: ${fixtures.length - fixedCount}`);

    if (fixedCount > 0) {
      console.log('\n⚠️  Important: You should now run the recalculate-s16-teamstats.js script to update team standings!');
    }

  } catch (error) {
    console.error('❌ Error fixing penalty goals:', error);
    throw error;
  }
}

// Run the script
fixPenaltyGoals()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
