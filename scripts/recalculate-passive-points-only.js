/**
 * Recalculate ONLY passive team bonus points with enhanced rules
 * This will delete old bonus records and recalculate with all configured rules
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);
const tournamentDb = neon(process.env.NEON_TOURNAMENT_DB_URL);

async function recalculatePassivePoints() {
  console.log('🔄 Recalculating Passive Team Bonus Points\n');
  console.log('='.repeat(60));

  try {
    // Step 1: Get active fantasy leagues
    console.log('\n📋 Step 1: Getting active fantasy leagues...');
    const leagues = await fantasyDb`
      SELECT league_id, season_id
      FROM fantasy_leagues
      WHERE is_active = true
    `;

    if (leagues.length === 0) {
      console.log('❌ No active fantasy leagues found');
      return;
    }

    console.log(`✅ Found ${leagues.length} active league(s)`);
    leagues.forEach(l => console.log(`   - League: ${l.league_id}`));

    for (const league of leagues) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Processing League: ${league.league_id}`);
      console.log('='.repeat(60));

      // Step 2: Get team scoring rules
      console.log('\n📊 Step 2: Loading team scoring rules...');
      const teamRules = await fantasyDb`
        SELECT rule_type, points_value
        FROM fantasy_scoring_rules
        WHERE league_id = ${league.league_id}
          AND applies_to = 'team'
          AND is_active = true
      `;

      if (teamRules.length === 0) {
        console.log('⏭️  No team scoring rules configured, skipping');
        continue;
      }

      console.log(`✅ Found ${teamRules.length} team scoring rules:`);
      teamRules.forEach(rule => {
        const sign = rule.points_value > 0 ? '+' : '';
        console.log(`   ${rule.rule_type}: ${sign}${rule.points_value} pts`);
      });

      const teamScoringRules = new Map();
      teamRules.forEach(rule => {
        teamScoringRules.set(rule.rule_type, rule.points_value);
      });

      // Step 3: Reset passive points to 0
      console.log('\n🔄 Step 3: Resetting passive points to 0...');
      await fantasyDb`
        UPDATE fantasy_teams
        SET passive_points = 0
        WHERE league_id = ${league.league_id}
      `;
      console.log('✅ Reset complete');

      // Step 4: Delete old bonus records
      console.log('\n🗑️  Step 4: Deleting old bonus records...');
      const deleteResult = await fantasyDb`
        DELETE FROM fantasy_team_bonus_points
        WHERE league_id = ${league.league_id}
      `;
      console.log(`✅ Deleted old records`);

      // Step 5: Get all completed fixtures for this season
      console.log('\n🏟️  Step 5: Getting completed fixtures...');
      const fixtures = await tournamentDb`
        SELECT 
          id,
          home_team_id,
          away_team_id,
          round_number,
          status
        FROM fixtures
        WHERE season_id = ${league.season_id}
          AND status = 'completed'
        ORDER BY round_number ASC
      `;

      console.log(`✅ Found ${fixtures.length} completed fixtures`);

      let totalBonusesAwarded = 0;
      let fixturesProcessed = 0;

      // Step 6: Process each fixture
      console.log('\n⚙️  Step 6: Recalculating bonuses...\n');

      for (const fixture of fixtures) {
        // Get matchup results
        const matchups = await tournamentDb`
          SELECT home_goals, away_goals
          FROM matchups
          WHERE fixture_id = ${fixture.id}
        `;

        if (matchups.length === 0) continue;

        // Calculate aggregate scores
        let homeTeamGoals = 0;
        let awayTeamGoals = 0;

        for (const matchup of matchups) {
          homeTeamGoals += matchup.home_goals || 0;
          awayTeamGoals += matchup.away_goals || 0;
        }

        // Award bonuses for home team
        const homeBonuses = await awardTeamBonus({
          fantasy_league_id: league.league_id,
          real_team_id: fixture.home_team_id,
          fixture_id: fixture.id,
          round_number: fixture.round_number,
          goals_scored: homeTeamGoals,
          goals_conceded: awayTeamGoals,
          teamScoringRules,
        });

        // Award bonuses for away team
        const awayBonuses = await awardTeamBonus({
          fantasy_league_id: league.league_id,
          real_team_id: fixture.away_team_id,
          fixture_id: fixture.id,
          round_number: fixture.round_number,
          goals_scored: awayTeamGoals,
          goals_conceded: homeTeamGoals,
          teamScoringRules,
        });

        totalBonusesAwarded += homeBonuses + awayBonuses;
        fixturesProcessed++;

        if (fixturesProcessed % 5 === 0) {
          console.log(`   Processed ${fixturesProcessed}/${fixtures.length} fixtures...`);
        }
      }

      console.log(`\n✅ Processed all ${fixturesProcessed} fixtures`);
      console.log(`✅ Awarded ${totalBonusesAwarded} total bonus points`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ RECALCULATION COMPLETE!');
    console.log('='.repeat(60));
    console.log('\n💡 Summary:');
    console.log('   - Old passive points deleted');
    console.log('   - New bonuses calculated with ALL configured rules');
    console.log('   - Breakdown data saved for each round');
    console.log('\n🎉 Passive points now include all bonus types!');

  } catch (error) {
    console.error('\n❌ Error during recalculation:', error);
    throw error;
  }
}

async function awardTeamBonus(params) {
  const {
    fantasy_league_id,
    real_team_id,
    fixture_id,
    round_number,
    goals_scored,
    goals_conceded,
    teamScoringRules,
  } = params;

  // Get fantasy teams affiliated with this real team
  // NOTE: Fantasy teams store IDs like "SSPSLT0015_SSPSLS16" but fixtures use "SSPSLT0015"
  // So we need to match by stripping the season suffix
  const fantasyTeams = await fantasyDb`
    SELECT team_id, team_name, supported_team_id, supported_team_name
    FROM fantasy_teams
    WHERE league_id = ${fantasy_league_id}
      AND supported_team_id IS NOT NULL
      AND (
        supported_team_id = ${real_team_id}
        OR supported_team_id LIKE ${real_team_id + '_%'}
      )
  `;

  if (fantasyTeams.length === 0) {
    return 0;
  }

  // Calculate bonuses based on configured rules (ENHANCED VERSION)
  const won = goals_scored > goals_conceded;
  const draw = goals_scored === goals_conceded;
  const lost = goals_scored < goals_conceded;
  const clean_sheet = goals_conceded === 0;
  const goal_margin = Math.abs(goals_scored - goals_conceded);

  const bonus_breakdown = {};
  let total_bonus = 0;

  // Apply ALL configured scoring rules dynamically
  teamScoringRules.forEach((points, ruleType) => {
    let applies = false;

    switch (ruleType) {
      // Result-based rules
      case 'win':
        applies = won;
        break;
      case 'draw':
        applies = draw;
        break;
      case 'loss':
        applies = lost;
        break;

      // Defense-based rules
      case 'clean_sheet':
        applies = clean_sheet;
        break;
      case 'concedes_4_plus_goals':
        applies = goals_conceded >= 4;
        break;
      case 'concedes_6_plus_goals':
        applies = goals_conceded >= 6;
        break;
      case 'concedes_8_plus_goals':
        applies = goals_conceded >= 8;
        break;
      case 'concedes_10_plus_goals':
        applies = goals_conceded >= 10;
        break;
      case 'concedes_15_plus_goals':
        applies = goals_conceded >= 15;
        break;

      // Attack-based rules
      case 'scored_4_plus_goals':
      case 'high_scoring':
        applies = goals_scored >= 4;
        break;
      case 'scored_6_plus_goals':
        applies = goals_scored >= 6;
        break;
      case 'scored_8_plus_goals':
        applies = goals_scored >= 8;
        break;
      case 'scored_10_plus_goals':
        applies = goals_scored >= 10;
        break;
      case 'scored_15_plus_goals':
        applies = goals_scored >= 15;
        break;

      // Margin-based rules
      case 'big_win':
        applies = won && goal_margin >= 3;
        break;
      case 'huge_win':
        applies = won && goal_margin >= 5;
        break;
      case 'narrow_win':
        applies = won && goal_margin === 1;
        break;

      // Combined rules
      case 'shutout_win':
        applies = won && clean_sheet;
        break;

      default:
        applies = false;
    }

    if (applies) {
      bonus_breakdown[ruleType] = points;
      total_bonus += points;
    }
  });

  if (total_bonus === 0) {
    return 0;
  }

  let totalAwarded = 0;

  // Award bonuses to each fantasy team
  for (const fantasyTeam of fantasyTeams) {
    // Insert bonus record
    await fantasyDb`
      INSERT INTO fantasy_team_bonus_points (
        league_id,
        team_id,
        real_team_id,
        real_team_name,
        fixture_id,
        round_number,
        bonus_breakdown,
        total_bonus,
        calculated_at
      ) VALUES (
        ${fantasy_league_id},
        ${fantasyTeam.team_id},
        ${real_team_id},
        ${fantasyTeam.supported_team_name},
        ${fixture_id},
        ${round_number},
        ${JSON.stringify(bonus_breakdown)},
        ${total_bonus},
        NOW()
      )
    `;

    // Update fantasy team points
    await fantasyDb`
      UPDATE fantasy_teams
      SET
        passive_points = passive_points + ${total_bonus},
        total_points = total_points + ${total_bonus},
        updated_at = NOW()
      WHERE team_id = ${fantasyTeam.team_id}
    `;

    totalAwarded += total_bonus;

    console.log(`   Round ${round_number}: ${fantasyTeam.team_name} → ${total_bonus > 0 ? '+' : ''}${total_bonus} pts (${Object.keys(bonus_breakdown).join(', ')})`);
  }

  return totalAwarded;
}

recalculatePassivePoints()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
