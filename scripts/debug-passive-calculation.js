/**
 * Debug why passive points aren't being awarded
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);
const tournamentDb = neon(process.env.NEON_TOURNAMENT_DB_URL);

async function debug() {
  console.log('🔍 Debugging Passive Points Calculation\n');

  try {
    // 1. Get a completed fixture
    const fixtures = await tournamentDb`
      SELECT 
        id,
        home_team_id,
        away_team_id,
        home_team_name,
        away_team_name,
        round_number,
        season_id
      FROM fixtures
      WHERE season_id = 'SSPSLS16'
        AND status = 'completed'
      LIMIT 1
    `;

    if (fixtures.length === 0) {
      console.log('No fixtures found');
      return;
    }

    const fixture = fixtures[0];
    console.log('📋 Sample Fixture:');
    console.log(`   ${fixture.home_team_name} vs ${fixture.away_team_name}`);
    console.log(`   Home Team ID: ${fixture.home_team_id}`);
    console.log(`   Away Team ID: ${fixture.away_team_id}`);
    console.log('');

    // 2. Check fantasy teams
    console.log('🎮 Fantasy Teams:');
    const fantasyTeams = await fantasyDb`
      SELECT 
        team_id,
        team_name,
        supported_team_id,
        supported_team_name
      FROM fantasy_teams
      WHERE league_id = 'SSPSLFLS16'
        AND supported_team_id IS NOT NULL
    `;

    console.log(`   Found ${fantasyTeams.length} fantasy teams with affiliations:`);
    fantasyTeams.forEach(t => {
      console.log(`   - ${t.team_name} → ${t.supported_team_name} (${t.supported_team_id})`);
    });
    console.log('');

    // 3. Check if any match
    console.log('🔗 Checking Matches:');
    const homeMatches = fantasyTeams.filter(t => t.supported_team_id === fixture.home_team_id);
    const awayMatches = fantasyTeams.filter(t => t.supported_team_id === fixture.away_team_id);

    console.log(`   Home team (${fixture.home_team_id}): ${homeMatches.length} fantasy teams`);
    console.log(`   Away team (${fixture.away_team_id}): ${awayMatches.length} fantasy teams`);

    if (homeMatches.length === 0 && awayMatches.length === 0) {
      console.log('\n❌ PROBLEM FOUND:');
      console.log('   No fantasy teams support the real teams in this fixture!');
      console.log('');
      console.log('   Fixture teams:');
      console.log(`   - ${fixture.home_team_name} (${fixture.home_team_id})`);
      console.log(`   - ${fixture.away_team_name} (${fixture.away_team_id})`);
      console.log('');
      console.log('   Fantasy teams support:');
      fantasyTeams.forEach(t => {
        console.log(`   - ${t.supported_team_name} (${t.supported_team_id})`);
      });
      console.log('');
      console.log('💡 This is expected if fantasy teams support tournament teams,');
      console.log('   not the teams playing in inter-team fixtures.');
    } else {
      console.log('\n✅ Matches found! Bonuses should be awarded.');
    }

    // 4. Check matchup scores
    console.log('\n⚽ Matchup Scores:');
    const matchups = await tournamentDb`
      SELECT home_goals, away_goals
      FROM matchups
      WHERE fixture_id = ${fixture.id}
    `;

    let homeTotal = 0;
    let awayTotal = 0;
    matchups.forEach(m => {
      homeTotal += m.home_goals || 0;
      awayTotal += m.away_goals || 0;
    });

    console.log(`   ${matchups.length} matchups`);
    console.log(`   Home total: ${homeTotal} goals`);
    console.log(`   Away total: ${awayTotal} goals`);
    console.log(`   Result: ${homeTotal > awayTotal ? 'Home Win' : homeTotal < awayTotal ? 'Away Win' : 'Draw'}`);

    // 5. Calculate what bonuses WOULD be awarded
    console.log('\n🎁 Bonuses That Would Be Awarded:');
    
    const rules = await fantasyDb`
      SELECT rule_type, points_value
      FROM fantasy_scoring_rules
      WHERE league_id = 'SSPSLFLS16'
        AND applies_to = 'team'
        AND is_active = true
    `;

    const calculateBonuses = (scored, conceded) => {
      const won = scored > conceded;
      const draw = scored === conceded;
      const lost = scored < conceded;
      const clean_sheet = conceded === 0;

      const bonuses = [];
      let total = 0;

      rules.forEach(rule => {
        let applies = false;

        switch (rule.rule_type) {
          case 'win': applies = won; break;
          case 'draw': applies = draw; break;
          case 'loss': applies = lost; break;
          case 'clean_sheet': applies = clean_sheet; break;
          case 'scored_6_plus_goals': applies = scored >= 6; break;
          case 'concedes_15_plus_goals': applies = conceded >= 15; break;
        }

        if (applies) {
          bonuses.push(`${rule.rule_type}: ${rule.points_value > 0 ? '+' : ''}${rule.points_value}`);
          total += rule.points_value;
        }
      });

      return { bonuses, total };
    };

    const homeBonus = calculateBonuses(homeTotal, awayTotal);
    const awayBonus = calculateBonuses(awayTotal, homeTotal);

    console.log(`   Home team (${fixture.home_team_name}):`);
    if (homeBonus.bonuses.length > 0) {
      homeBonus.bonuses.forEach(b => console.log(`     ${b}`));
      console.log(`     Total: ${homeBonus.total > 0 ? '+' : ''}${homeBonus.total}`);
    } else {
      console.log(`     No bonuses`);
    }

    console.log(`   Away team (${fixture.away_team_name}):`);
    if (awayBonus.bonuses.length > 0) {
      awayBonus.bonuses.forEach(b => console.log(`     ${b}`));
      console.log(`     Total: ${awayBonus.total > 0 ? '+' : ''}${awayBonus.total}`);
    } else {
      console.log(`     No bonuses`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

debug()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
