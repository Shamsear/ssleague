/**
 * Test that passive points are calculated when results are submitted
 * This simulates what happens when a fixture result is saved
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const tournamentDb = neon(process.env.NEON_TOURNAMENT_DB_URL);
const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);

async function testPassiveOnSubmit() {
  console.log('🧪 Testing Passive Points on Result Submit...\n');

  try {
    // 1. Find a completed fixture
    console.log('1️⃣ Finding a completed fixture...');
    const fixtures = await tournamentDb`
      SELECT 
        id,
        home_team_id,
        away_team_id,
        home_team_name,
        away_team_name,
        round_number,
        season_id,
        status
      FROM fixtures
      WHERE status = 'completed'
      ORDER BY round_number DESC
      LIMIT 1
    `;

    if (fixtures.length === 0) {
      console.log('❌ No completed fixtures found');
      return;
    }

    const fixture = fixtures[0];
    console.log(`Found: ${fixture.home_team_name} vs ${fixture.away_team_name}`);
    console.log(`  Fixture ID: ${fixture.id}`);
    console.log(`  Round: ${fixture.round_number}`);
    console.log(`  Season: ${fixture.season_id}`);
    console.log('');

    // 2. Check if fantasy league exists for this season
    console.log('2️⃣ Checking fantasy league...');
    const leagues = await fantasyDb`
      SELECT league_id, is_active
      FROM fantasy_leagues
      WHERE season_id = ${fixture.season_id}
      LIMIT 1
    `;

    if (leagues.length === 0) {
      console.log('❌ No fantasy league for this season');
      return;
    }

    const leagueId = leagues[0].league_id;
    console.log(`✅ Fantasy league: ${leagueId}`);
    console.log('');

    // 3. Check matchup results
    console.log('3️⃣ Checking matchup results...');
    const matchups = await tournamentDb`
      SELECT home_goals, away_goals
      FROM matchups
      WHERE fixture_id = ${fixture.id}
    `;

    if (matchups.length === 0) {
      console.log('❌ No matchups found');
      return;
    }

    let homeGoals = 0;
    let awayGoals = 0;
    matchups.forEach(m => {
      homeGoals += m.home_goals || 0;
      awayGoals += m.away_goals || 0;
    });

    console.log(`Matchups: ${matchups.length}`);
    console.log(`Home total: ${homeGoals} goals`);
    console.log(`Away total: ${awayGoals} goals`);
    console.log(`Result: ${homeGoals > awayGoals ? 'Home Win' : homeGoals < awayGoals ? 'Away Win' : 'Draw'}`);
    console.log('');

    // 4. Check if passive points were awarded
    console.log('4️⃣ Checking if passive points were awarded...');
    const bonusRecords = await fantasyDb`
      SELECT 
        ftbp.team_id,
        ft.team_name,
        ftbp.real_team_name,
        ftbp.bonus_breakdown,
        ftbp.total_bonus
      FROM fantasy_team_bonus_points ftbp
      JOIN fantasy_teams ft ON ftbp.team_id = ft.team_id
      WHERE ftbp.fixture_id = ${fixture.id}
      ORDER BY ftbp.total_bonus DESC
    `;

    if (bonusRecords.length === 0) {
      console.log('⚠️  No passive points awarded for this fixture');
      console.log('   Possible reasons:');
      console.log('   - No fantasy teams are affiliated with the real teams in this fixture');
      console.log('   - Fantasy points calculation was not triggered');
      console.log('   - No team scoring rules configured');
      return;
    }

    console.log(`✅ Found ${bonusRecords.length} passive point awards:\n`);
    bonusRecords.forEach(record => {
      let breakdown = record.bonus_breakdown;
      if (typeof breakdown === 'string') {
        try {
          breakdown = JSON.parse(breakdown);
        } catch (e) {
          breakdown = {};
        }
      }

      console.log(`  ${record.team_name} (supporting ${record.real_team_name}): +${record.total_bonus} pts`);
      if (breakdown && Object.keys(breakdown).length > 0) {
        Object.entries(breakdown).forEach(([type, value]) => {
          console.log(`    - ${type}: +${value}`);
        });
      } else {
        console.log(`    ⚠️  No breakdown data`);
      }
    });

    // 5. Verify breakdown data quality
    console.log('\n5️⃣ Verifying breakdown data quality...');
    let allHaveBreakdown = true;
    let allTotalsMatch = true;

    bonusRecords.forEach(record => {
      let breakdown = record.bonus_breakdown;
      if (typeof breakdown === 'string') {
        try {
          breakdown = JSON.parse(breakdown);
        } catch (e) {
          breakdown = null;
        }
      }

      if (!breakdown || Object.keys(breakdown).length === 0) {
        allHaveBreakdown = false;
        console.log(`  ❌ ${record.team_name}: Missing breakdown`);
      } else {
        const calculatedTotal = Object.values(breakdown).reduce((sum, val) => sum + (Number(val) || 0), 0);
        if (calculatedTotal !== record.total_bonus) {
          allTotalsMatch = false;
          console.log(`  ❌ ${record.team_name}: Breakdown sum (${calculatedTotal}) doesn't match total (${record.total_bonus})`);
        }
      }
    });

    if (allHaveBreakdown && allTotalsMatch) {
      console.log('  ✅ All records have valid breakdown data');
    }

    console.log('\n✅ Test Complete!');
    console.log('\n💡 Summary:');
    console.log(`   - Fixture has ${matchups.length} matchups with results`);
    console.log(`   - ${bonusRecords.length} fantasy teams received passive points`);
    console.log(`   - All records ${allHaveBreakdown ? 'have' : 'DO NOT have'} breakdown data`);
    console.log(`   - Breakdown totals ${allTotalsMatch ? 'match' : 'DO NOT match'} recorded totals`);

  } catch (error) {
    console.error('❌ Error during test:', error);
    throw error;
  }
}

testPassiveOnSubmit()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
