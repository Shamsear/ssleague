/**
 * Recalculate Fantasy Player Points
 * 
 * This script recalculates fantasy points for all players based on their
 * actual performance in fixtures (goals, clean sheets, MOTM, etc.)
 * with captain (2x) and vice-captain (1.5x) multipliers applied.
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

// Fantasy scoring rules (adjust these as needed)
const SCORING_RULES = {
  goal: 5,              // Points per goal scored
  assist: 3,            // Points per assist
  clean_sheet: 4,       // Points for clean sheet (0 goals conceded)
  motm: 3,              // Points for Man of the Match
  win: 2,               // Points for winning the match
  draw: 1,              // Points for drawing the match
  appearance: 1,        // Points just for playing
};

async function recalculateFantasyPoints() {
  const sql = neon(process.env.DATABASE_URL);

  console.log('🔄 Starting fantasy points recalculation...\n');

  try {
    // 1. Get all fantasy rounds
    const fantasyRounds = await sql`
      SELECT fr.*, r.season_id, r.tournament_id
      FROM fantasy_rounds fr
      JOIN rounds r ON fr.round_id = r.id
      WHERE fr.is_completed = true
      ORDER BY fr.round_number
    `;

    console.log(`📊 Found ${fantasyRounds.length} completed fantasy rounds\n`);

    // 2. Clear existing points
    console.log('🗑️  Clearing existing fantasy points...');
    await sql`DELETE FROM fantasy_player_points`;
    console.log('✅ Cleared\n');

    // 3. For each fantasy round, calculate points
    for (const round of fantasyRounds) {
      console.log(`\n📍 Processing Round ${round.round_number} (${round.fantasy_round_id})...`);

      // Get all fixtures in this round
      const fixtures = await sql`
        SELECT 
          f.id as fixture_id,
          f.home_team_id,
          f.away_team_id,
          f.home_score,
          f.away_score,
          f.motm_player_id
        FROM fixtures f
        WHERE f.round_id = ${round.round_id}
          AND f.status = 'completed'
      `;

      console.log(`  Found ${fixtures.length} completed fixtures`);

      // Get all matchups (player performances) for these fixtures
      const matchups = await sql`
        SELECT 
          m.fixture_id,
          m.home_player_id,
          m.home_player_name,
          m.away_player_id,
          m.away_player_name,
          m.home_goals,
          m.away_goals,
          f.home_score,
          f.away_score,
          f.motm_player_id
        FROM matchups m
        JOIN fixtures f ON m.fixture_id = f.id
        WHERE f.round_id = ${round.round_id}
          AND f.status = 'completed'
      `;

      console.log(`  Found ${matchups.length} player matchups`);

      // Build player performance map
      const playerPerformances = new Map();

      for (const matchup of matchups) {
        // Home player performance
        const homeWon = matchup.home_goals > matchup.away_goals;
        const homeDraw = matchup.home_goals === matchup.away_goals;
        const homeCleanSheet = matchup.away_goals === 0;
        const homeIsMotm = matchup.motm_player_id === matchup.home_player_id;

        const homePoints = 
          (matchup.home_goals || 0) * SCORING_RULES.goal +
          (homeCleanSheet ? SCORING_RULES.clean_sheet : 0) +
          (homeIsMotm ? SCORING_RULES.motm : 0) +
          (homeWon ? SCORING_RULES.win : homeDraw ? SCORING_RULES.draw : 0) +
          SCORING_RULES.appearance;

        if (!playerPerformances.has(matchup.home_player_id)) {
          playerPerformances.set(matchup.home_player_id, {
            player_id: matchup.home_player_id,
            player_name: matchup.home_player_name,
            base_points: 0,
            goals: 0,
            assists: 0,
            clean_sheets: 0,
            motm_count: 0,
            wins: 0,
            draws: 0,
            appearances: 0,
          });
        }

        const homePerf = playerPerformances.get(matchup.home_player_id);
        homePerf.base_points += homePoints;
        homePerf.goals += matchup.home_goals || 0;
        homePerf.clean_sheets += homeCleanSheet ? 1 : 0;
        homePerf.motm_count += homeIsMotm ? 1 : 0;
        homePerf.wins += homeWon ? 1 : 0;
        homePerf.draws += homeDraw ? 1 : 0;
        homePerf.appearances += 1;

        // Away player performance
        const awayWon = matchup.away_goals > matchup.home_goals;
        const awayDraw = matchup.away_goals === matchup.home_goals;
        const awayCleanSheet = matchup.home_goals === 0;
        const awayIsMotm = matchup.motm_player_id === matchup.away_player_id;

        const awayPoints = 
          (matchup.away_goals || 0) * SCORING_RULES.goal +
          (awayCleanSheet ? SCORING_RULES.clean_sheet : 0) +
          (awayIsMotm ? SCORING_RULES.motm : 0) +
          (awayWon ? SCORING_RULES.win : awayDraw ? SCORING_RULES.draw : 0) +
          SCORING_RULES.appearance;

        if (!playerPerformances.has(matchup.away_player_id)) {
          playerPerformances.set(matchup.away_player_id, {
            player_id: matchup.away_player_id,
            player_name: matchup.away_player_name,
            base_points: 0,
            goals: 0,
            assists: 0,
            clean_sheets: 0,
            motm_count: 0,
            wins: 0,
            draws: 0,
            appearances: 0,
          });
        }

        const awayPerf = playerPerformances.get(matchup.away_player_id);
        awayPerf.base_points += awayPoints;
        awayPerf.goals += matchup.away_goals || 0;
        awayPerf.clean_sheets += awayCleanSheet ? 1 : 0;
        awayPerf.motm_count += awayIsMotm ? 1 : 0;
        awayPerf.wins += awayWon ? 1 : 0;
        awayPerf.draws += awayDraw ? 1 : 0;
        awayPerf.appearances += 1;
      }

      console.log(`  Calculated performance for ${playerPerformances.size} unique players`);

      // Get all fantasy teams in this league
      const fantasyTeams = await sql`
        SELECT team_id, league_id
        FROM fantasy_teams
        WHERE league_id = ${round.league_id}
      `;

      console.log(`  Processing ${fantasyTeams.length} fantasy teams...`);

      let totalPointsAwarded = 0;

      // For each fantasy team, award points to their squad players
      for (const team of fantasyTeams) {
        // Get squad with captain/VC info
        const squad = await sql`
          SELECT 
            player_id,
            is_captain,
            is_vice_captain
          FROM fantasy_squad
          WHERE team_id = ${team.team_id}
        `;

        for (const squadPlayer of squad) {
          const performance = playerPerformances.get(squadPlayer.player_id);
          
          if (performance) {
            // Apply multipliers
            let finalPoints = performance.base_points;
            let multiplier = 1;

            if (squadPlayer.is_captain) {
              multiplier = 2;
              finalPoints = performance.base_points * 2;
            } else if (squadPlayer.is_vice_captain) {
              multiplier = 1.5;
              finalPoints = performance.base_points * 1.5;
            }

            // Insert points record
            await sql`
              INSERT INTO fantasy_player_points (
                team_id,
                player_id,
                fantasy_round_id,
                points,
                points_breakdown
              ) VALUES (
                ${team.team_id},
                ${squadPlayer.player_id},
                ${round.fantasy_round_id},
                ${finalPoints},
                ${JSON.stringify({
                  base_points: performance.base_points,
                  multiplier: multiplier,
                  goals: performance.goals,
                  assists: performance.assists,
                  clean_sheets: performance.clean_sheets,
                  motm: performance.motm_count,
                  wins: performance.wins,
                  draws: performance.draws,
                  appearances: performance.appearances,
                })}
              )
            `;

            totalPointsAwarded += finalPoints;
          }
        }
      }

      console.log(`  ✅ Round ${round.round_number} complete - ${totalPointsAwarded} total points awarded`);
    }

    // 4. Update team totals
    console.log('\n📊 Updating team totals...');
    await sql`
      UPDATE fantasy_teams ft
      SET total_points = (
        SELECT COALESCE(SUM(points), 0)
        FROM fantasy_player_points fpp
        WHERE fpp.team_id = ft.team_id
      )
    `;

    console.log('✅ Team totals updated\n');
    console.log('🎉 Fantasy points recalculation complete!');

  } catch (error) {
    console.error('❌ Error recalculating fantasy points:', error);
    throw error;
  }
}

// Run the script
recalculateFantasyPoints()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
