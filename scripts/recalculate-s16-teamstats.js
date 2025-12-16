/**
 * Script to recalculate Season 16 team stats from completed fixtures
 * This will reset and rebuild all team statistics including penalty goals
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const SEASON_ID = 'SSPSLS16';

async function recalculateTeamStats() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

  console.log('🔄 Recalculating Season 16 team stats...\n');

  try {
    // Step 1: Reset all team stats for Season 16
    console.log('📊 Step 1: Resetting existing stats...');
    await sql`
      UPDATE teamstats
      SET
        matches_played = 0,
        wins = 0,
        draws = 0,
        losses = 0,
        goals_for = 0,
        goals_against = 0,
        goal_difference = 0,
        points = 0,
        current_form = '',
        win_streak = 0,
        unbeaten_streak = 0,
        processed_fixtures = '[]'::jsonb,
        updated_at = NOW()
      WHERE season_id = ${SEASON_ID}
    `;
    console.log('✅ Stats reset complete\n');

    // Step 2: Get all completed fixtures for Season 16
    console.log('📋 Step 2: Fetching completed fixtures...');
    const fixtures = await sql`
      SELECT 
        f.id as fixture_id,
        f.home_team_id,
        f.away_team_id,
        f.home_score,
        f.away_score,
        f.home_penalty_goals,
        f.away_penalty_goals,
        f.tournament_id,
        f.round_number
      FROM fixtures f
      WHERE f.season_id = ${SEASON_ID}
        AND f.status = 'completed'
        AND f.home_score IS NOT NULL
        AND f.away_score IS NOT NULL
      ORDER BY f.round_number ASC, f.id ASC
    `;

    console.log(`✅ Found ${fixtures.length} completed fixtures\n`);

    if (fixtures.length === 0) {
      console.log('⚠️  No completed fixtures found for Season 16');
      return;
    }

    // Step 3: Process each fixture
    console.log('⚙️  Step 3: Processing fixtures...\n');
    let processedCount = 0;

    for (const fixture of fixtures) {
      const homeScore = fixture.home_score;
      const awayScore = fixture.away_score;
      const homePenalty = fixture.home_penalty_goals || 0;
      const awayPenalty = fixture.away_penalty_goals || 0;

      // Determine result
      const homeWon = homeScore > awayScore;
      const awayWon = awayScore > homeScore;
      const draw = homeScore === awayScore;

      // Update home team
      await updateTeamStats({
        sql,
        team_id: fixture.home_team_id,
        season_id: SEASON_ID,
        fixture_id: fixture.fixture_id,
        goals_for: homeScore,
        goals_against: awayScore,
        won: homeWon,
        draw: draw,
        lost: awayWon
      });

      // Update away team
      await updateTeamStats({
        sql,
        team_id: fixture.away_team_id,
        season_id: SEASON_ID,
        fixture_id: fixture.fixture_id,
        goals_for: awayScore,
        goals_against: homeScore,
        won: awayWon,
        draw: draw,
        lost: homeWon
      });

      processedCount++;
      const penaltyInfo = (homePenalty > 0 || awayPenalty > 0) 
        ? ` (Penalties: H:${homePenalty}, A:${awayPenalty})` 
        : '';
      console.log(`   ✓ Fixture ${processedCount}/${fixtures.length}: ${homeScore}-${awayScore}${penaltyInfo}`);
    }

    console.log(`\n✅ Processed ${processedCount} fixtures\n`);

    // Step 4: Recalculate positions for each tournament
    console.log('🏆 Step 4: Recalculating positions...');
    const tournaments = await sql`
      SELECT DISTINCT tournament_id
      FROM teamstats
      WHERE season_id = ${SEASON_ID}
        AND tournament_id IS NOT NULL
    `;

    for (const tournament of tournaments) {
      await recalculatePositions(sql, SEASON_ID, tournament.tournament_id);
    }

    // Step 5: Display final standings
    console.log('\n📊 Final Standings:\n');
    const finalStandings = await sql`
      SELECT 
        team_name,
        matches_played,
        wins,
        draws,
        losses,
        goals_for,
        goals_against,
        goal_difference,
        points,
        current_form,
        position
      FROM teamstats
      WHERE season_id = ${SEASON_ID}
      ORDER BY points DESC, goal_difference DESC, goals_for DESC
      LIMIT 20
    `;

    console.log('Pos | Team                    | MP | W  | D  | L  | GF  | GA  | GD   | Pts | Form');
    console.log('----+-------------------------+----+----+----+----+-----+-----+------+-----+------');
    finalStandings.forEach((team, index) => {
      const pos = String(index + 1).padStart(3);
      const name = team.team_name.padEnd(23);
      const mp = String(team.matches_played).padStart(2);
      const w = String(team.wins).padStart(2);
      const d = String(team.draws).padStart(2);
      const l = String(team.losses).padStart(2);
      const gf = String(team.goals_for).padStart(3);
      const ga = String(team.goals_against).padStart(3);
      const gd = String(team.goal_difference > 0 ? '+' + team.goal_difference : team.goal_difference).padStart(4);
      const pts = String(team.points).padStart(3);
      const form = (team.current_form || '').padEnd(5);
      
      console.log(`${pos} | ${name} | ${mp} | ${w} | ${d} | ${l} | ${gf} | ${ga} | ${gd} | ${pts} | ${form}`);
    });

    console.log('\n🎉 Team stats recalculation completed successfully!');

  } catch (error) {
    console.error('❌ Error recalculating team stats:', error);
    throw error;
  }
}

async function updateTeamStats(params) {
  const { sql, team_id, season_id, fixture_id, goals_for, goals_against, won, draw, lost } = params;

  const statsId = `${team_id}_${season_id}`;

  // Get current stats
  const existing = await sql`
    SELECT * FROM teamstats WHERE id = ${statsId} LIMIT 1
  `;

  if (existing.length === 0) {
    console.warn(`   ⚠️  Team stats not found for ${team_id}, skipping`);
    return;
  }

  const current = existing[0];
  const processedFixtures = current.processed_fixtures || [];

  // Add this fixture
  const updatedProcessedFixtures = [...processedFixtures, {
    fixture_id,
    goals_for,
    goals_against,
    won,
    draw,
    lost
  }];

  const newMatches = (current.matches_played || 0) + 1;
  const newGoalsFor = (current.goals_for || 0) + goals_for;
  const newGoalsAgainst = (current.goals_against || 0) + goals_against;
  const newWins = (current.wins || 0) + (won ? 1 : 0);
  const newDraws = (current.draws || 0) + (draw ? 1 : 0);
  const newLosses = (current.losses || 0) + (lost ? 1 : 0);
  const newGoalDifference = newGoalsFor - newGoalsAgainst;
  const newPoints = (newWins * 3) + newDraws;

  // Calculate form
  const currentFormStr = current.current_form || '';
  const resultChar = won ? 'W' : draw ? 'D' : 'L';
  const newForm = (currentFormStr + resultChar).slice(-5);

  // Calculate streaks
  const newWinStreak = won ? (current.win_streak || 0) + 1 : 0;
  const newUnbeatenStreak = (won || draw) ? (current.unbeaten_streak || 0) + 1 : 0;

  await sql`
    UPDATE teamstats
    SET
      matches_played = ${newMatches},
      wins = ${newWins},
      draws = ${newDraws},
      losses = ${newLosses},
      goals_for = ${newGoalsFor},
      goals_against = ${newGoalsAgainst},
      goal_difference = ${newGoalDifference},
      points = ${newPoints},
      current_form = ${newForm},
      win_streak = ${newWinStreak},
      unbeaten_streak = ${newUnbeatenStreak},
      processed_fixtures = ${JSON.stringify(updatedProcessedFixtures)}::jsonb,
      updated_at = NOW()
    WHERE id = ${statsId}
  `;
}

async function recalculatePositions(sql, season_id, tournament_id) {
  const teams = await sql`
    SELECT id, points, goal_difference, goals_for
    FROM teamstats
    WHERE season_id = ${season_id}
      AND tournament_id = ${tournament_id}
    ORDER BY 
      points DESC,
      goal_difference DESC,
      goals_for DESC
  `;

  for (let i = 0; i < teams.length; i++) {
    const position = i + 1;
    await sql`
      UPDATE teamstats
      SET position = ${position}
      WHERE id = ${teams[i].id}
    `;
  }

  console.log(`   ✓ Updated positions for ${teams.length} teams in tournament ${tournament_id}`);
}

// Run the script
recalculateTeamStats()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
