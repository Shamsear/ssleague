/**
 * Script to calculate and award passive team points for all completed fixtures
 * This will:
 * 1. Remove all existing passive points from fantasy teams
 * 2. Delete all existing team bonus records
 * 3. Recalculate and award passive points based on supported real team's performance
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function calculatePassiveTeamPoints() {
  const fantasySql = neon(process.env.FANTASY_DATABASE_URL);
  const tournamentSql = neon(process.env.NEON_TOURNAMENT_DB_URL);

  console.log('🎮 Starting passive team points recalculation...\n');

  try {
    // Get all active fantasy leagues
    const leagues = await fantasySql`
      SELECT id, league_id, season_id, is_active
      FROM fantasy_leagues
      WHERE is_active = true
    `;

    if (leagues.length === 0) {
      console.log('❌ No active fantasy leagues found');
      return;
    }

    console.log(`✅ Found ${leagues.length} active fantasy league(s)\n`);

    // Step 1: Reset all passive points to 0 and adjust total_points
    console.log('🔄 Step 1: Resetting all passive points...\n');
    for (const league of leagues) {
      const resetResult = await fantasySql`
        UPDATE fantasy_teams
        SET 
          total_points = total_points - COALESCE(passive_points, 0),
          passive_points = 0,
          updated_at = NOW()
        WHERE league_id = ${league.league_id}
          AND passive_points > 0
      `;
      console.log(`   ✅ Reset passive points for league ${league.league_id}`);
    }

    // Step 2: Delete all existing team bonus records
    console.log('\n🗑️  Step 2: Deleting all existing team bonus records...\n');
    const deleteResult = await fantasySql`
      DELETE FROM fantasy_team_bonus_points
      WHERE league_id IN (SELECT league_id FROM fantasy_leagues WHERE is_active = true)
    `;
    console.log(`   ✅ Deleted all existing team bonus records\n`);

    console.log('🎯 Step 3: Recalculating passive points from scratch...\n');

    for (const league of leagues) {
      console.log(`\n📊 Processing league: ${league.league_id} (Season: ${league.season_id})`);
      
      // Get team-specific scoring rules
      const teamRules = await fantasySql`
        SELECT rule_type, points_value
        FROM fantasy_scoring_rules
        WHERE league_id = ${league.league_id}
          AND applies_to = 'team'
          AND is_active = true
      `;

      if (teamRules.length === 0) {
        console.log('⏭️  No team scoring rules found, skipping...');
        continue;
      }

      const teamScoringRules = new Map();
      teamRules.forEach(rule => {
        teamScoringRules.set(rule.rule_type, rule.points_value);
        console.log(`   - ${rule.rule_type}: ${rule.points_value} points`);
      });

      // Get all completed fixtures for this season
      const fixtures = await tournamentSql`
        SELECT 
          f.id as fixture_id,
          f.season_id,
          f.round_number,
          f.home_team_id,
          f.away_team_id,
          f.home_score,
          f.away_score,
          f.status
        FROM fixtures f
        WHERE f.season_id = ${league.season_id}
          AND f.status = 'completed'
          AND f.home_score IS NOT NULL
          AND f.away_score IS NOT NULL
        ORDER BY f.round_number ASC
      `;

      console.log(`\n   Found ${fixtures.length} completed fixtures`);

      let totalBonusesAwarded = 0;
      let fixturesProcessed = 0;

      for (const fixture of fixtures) {
        // No need to check for existing bonuses since we deleted them all
        console.log(`   🔍 Processing Fixture ${fixture.fixture_id} (Round ${fixture.round_number}): Home=${fixture.home_team_id}, Away=${fixture.away_team_id}`);

        // Process home team
        const homeBonuses = await awardTeamBonus({
          fantasy_league_id: league.league_id,
          real_team_id: fixture.home_team_id,
          fixture_id: fixture.fixture_id,
          round_number: fixture.round_number,
          goals_scored: fixture.home_score,
          goals_conceded: fixture.away_score,
          teamScoringRules,
          fantasySql,
        });

        // Process away team
        const awayBonuses = await awardTeamBonus({
          fantasy_league_id: league.league_id,
          real_team_id: fixture.away_team_id,
          fixture_id: fixture.fixture_id,
          round_number: fixture.round_number,
          goals_scored: fixture.away_score,
          goals_conceded: fixture.home_score,
          teamScoringRules,
          fantasySql,
        });

        const fixtureTotal = homeBonuses + awayBonuses;
        if (fixtureTotal > 0) {
          console.log(`   ✅ Fixture ${fixture.fixture_id} (Round ${fixture.round_number}) - Awarded ${fixtureTotal} total points`);
          totalBonusesAwarded += fixtureTotal;
          fixturesProcessed++;
        }
      }

      console.log(`\n   📈 League Summary:`);
      console.log(`      - Fixtures processed: ${fixturesProcessed}`);
      console.log(`      - Total bonus points awarded: ${totalBonusesAwarded}`);

      // Show updated team standings
      const teams = await fantasySql`
        SELECT 
          team_name,
          player_points,
          passive_points,
          total_points,
          supported_team_name
        FROM fantasy_teams
        WHERE league_id = ${league.league_id}
        ORDER BY total_points DESC
        LIMIT 10
      `;

      console.log(`\n   🏆 Top 10 Teams After Recalculation:`);
      teams.forEach((team, index) => {
        console.log(`      ${index + 1}. ${team.team_name}: ${team.total_points} pts (Player: ${team.player_points || 0}, Passive: ${team.passive_points || 0}) - Supporting: ${team.supported_team_name || 'None'}`);
      });
    }

    console.log('\n\n🎉 Passive team points recalculation completed!');

  } catch (error) {
    console.error('❌ Error calculating passive team points:', error);
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
    fantasySql,
  } = params;

  // Get fantasy teams affiliated with this real team
  // Note: supported_team_id includes season suffix (e.g., SSPSLT0015_SSPSLS16)
  // but fixture team_id does not (e.g., SSPSLT0015)
  const fantasyTeams = await fantasySql`
    SELECT team_id, team_name, supported_team_id, supported_team_name
    FROM fantasy_teams
    WHERE league_id = ${fantasy_league_id}
      AND supported_team_id LIKE ${real_team_id + '_%'}
  `;

  if (fantasyTeams.length === 0) {
    // Debug: Check if ANY teams have supported_team_id set
    const allTeams = await fantasySql`
      SELECT team_id, team_name, supported_team_id, supported_team_name
      FROM fantasy_teams
      WHERE league_id = ${fantasy_league_id}
      LIMIT 5
    `;
    if (allTeams.length > 0) {
      console.log(`      ℹ️  Sample teams in league:`, allTeams.map(t => ({ name: t.team_name, supported: t.supported_team_id || 'NONE' })));
    }
    return 0;
  }

  // Calculate bonuses based on configured rules
  const won = goals_scored > goals_conceded;
  const draw = goals_scored === goals_conceded;
  const lost = goals_scored < goals_conceded;
  const clean_sheet = goals_conceded === 0;
  const high_scoring = goals_scored >= 4;

  const bonus_breakdown = {};
  let total_bonus = 0;

  // Apply scoring rules - try both with and without 'team_' prefix
  if (won) {
    if (teamScoringRules.has('win')) {
      bonus_breakdown.win = teamScoringRules.get('win');
      total_bonus += bonus_breakdown.win;
    } else if (teamScoringRules.has('team_win')) {
      bonus_breakdown.team_win = teamScoringRules.get('team_win');
      total_bonus += bonus_breakdown.team_win;
    }
  }
  if (draw) {
    if (teamScoringRules.has('draw')) {
      bonus_breakdown.draw = teamScoringRules.get('draw');
      total_bonus += bonus_breakdown.draw;
    } else if (teamScoringRules.has('team_draw')) {
      bonus_breakdown.team_draw = teamScoringRules.get('team_draw');
      total_bonus += bonus_breakdown.team_draw;
    }
  }
  if (lost) {
    if (teamScoringRules.has('loss')) {
      bonus_breakdown.loss = teamScoringRules.get('loss');
      total_bonus += bonus_breakdown.loss;
    } else if (teamScoringRules.has('team_loss')) {
      bonus_breakdown.team_loss = teamScoringRules.get('team_loss');
      total_bonus += bonus_breakdown.team_loss;
    }
  }
  if (clean_sheet) {
    if (teamScoringRules.has('clean_sheet')) {
      bonus_breakdown.clean_sheet = teamScoringRules.get('clean_sheet');
      total_bonus += bonus_breakdown.clean_sheet;
    } else if (teamScoringRules.has('team_clean_sheet')) {
      bonus_breakdown.team_clean_sheet = teamScoringRules.get('team_clean_sheet');
      total_bonus += bonus_breakdown.team_clean_sheet;
    }
  }
  if (high_scoring) {
    if (teamScoringRules.has('high_scoring')) {
      bonus_breakdown.high_scoring = teamScoringRules.get('high_scoring');
      total_bonus += bonus_breakdown.high_scoring;
    } else if (teamScoringRules.has('team_high_scoring')) {
      bonus_breakdown.team_high_scoring = teamScoringRules.get('team_high_scoring');
      total_bonus += bonus_breakdown.team_high_scoring;
    }
  }

  if (total_bonus === 0) {
    return 0;
  }

  let totalAwarded = 0;

  // Award bonuses to each fantasy team
  for (const fantasyTeam of fantasyTeams) {
    // Check if bonus already exists (to prevent duplicates)
    const existing = await fantasySql`
      SELECT id FROM fantasy_team_bonus_points
      WHERE league_id = ${fantasy_league_id}
        AND team_id = ${fantasyTeam.team_id}
        AND fixture_id = ${fixture_id}
      LIMIT 1
    `;

    if (existing.length > 0) {
      console.log(`      ⏭️  Bonus already exists for ${fantasyTeam.team_name} in fixture ${fixture_id}`);
      continue;
    }

    // Record bonus in fantasy_team_bonus_points
    await fantasySql`
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
    await fantasySql`
      UPDATE fantasy_teams
      SET
        passive_points = COALESCE(passive_points, 0) + ${total_bonus},
        total_points = COALESCE(total_points, 0) + ${total_bonus},
        updated_at = NOW()
      WHERE team_id = ${fantasyTeam.team_id}
    `;

    console.log(`      🎁 ${fantasyTeam.team_name} (+${total_bonus} pts for ${fantasyTeam.supported_team_name})`);
    totalAwarded += total_bonus;
  }

  return totalAwarded;
}

// Run the script
calculatePassiveTeamPoints()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
