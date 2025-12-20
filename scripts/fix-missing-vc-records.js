/**
 * Fix Missing Vice-Captain Records
 * Creates fantasy_player_points records for vice-captains who are missing them
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function fixMissingVCRecords() {
  const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);
  const tournamentDb = neon(process.env.NEON_TOURNAMENT_DB_URL);

  console.log('🔧 Fixing Missing Vice-Captain Records...\n');

  try {
    // Get all vice-captains
    const viceCaptains = await fantasyDb`
      SELECT 
        fs.team_id,
        fs.real_player_id,
        fs.player_name,
        ft.league_id
      FROM fantasy_squad fs
      JOIN fantasy_teams ft ON fs.team_id = ft.team_id
      WHERE fs.is_vice_captain = true
    `;

    console.log(`Found ${viceCaptains.length} vice-captains\n`);

    // Get scoring rules
    const scoringRulesData = await fantasyDb`
      SELECT rule_type, points_value, applies_to
      FROM fantasy_scoring_rules
      WHERE is_active = true
    `;

    const SCORING_RULES = {};
    scoringRulesData.forEach(rule => {
      if (rule.applies_to === 'player') {
        SCORING_RULES[rule.rule_type.toLowerCase()] = rule.points_value;
      }
    });

    // Get all completed matchups
    const matchups = await tournamentDb`
      SELECT 
        m.fixture_id,
        f.round_number,
        m.home_player_id,
        m.home_player_name,
        m.away_player_id,
        m.away_player_name,
        m.home_goals,
        m.away_goals,
        f.motm_player_id
      FROM matchups m
      JOIN fixtures f ON m.fixture_id = f.id
      WHERE f.status = 'completed'
        AND m.home_goals IS NOT NULL
        AND m.away_goals IS NOT NULL
      ORDER BY f.round_number
    `;

    console.log(`Found ${matchups.length} completed matchups\n`);

    let inserted = 0;
    let skipped = 0;

    for (const vc of viceCaptains) {
      console.log(`\nProcessing ${vc.player_name} in team ${vc.team_id}...`);

      // Find all matches this player played in
      const playerMatches = matchups.filter(m => 
        m.home_player_id === vc.real_player_id || m.away_player_id === vc.real_player_id
      );

      console.log(`  Found ${playerMatches.length} matches for this player`);

      for (const match of playerMatches) {
        // Check if record already exists
        const existing = await fantasyDb`
          SELECT id FROM fantasy_player_points
          WHERE team_id = ${vc.team_id}
            AND real_player_id = ${vc.real_player_id}
            AND fixture_id = ${match.fixture_id}
          LIMIT 1
        `;

        if (existing.length > 0) {
          skipped++;
          continue;
        }

        // Calculate points
        const isHome = match.home_player_id === vc.real_player_id;
        const goalsScored = isHome ? match.home_goals : match.away_goals;
        const goalsConceded = isHome ? match.away_goals : match.home_goals;
        const won = goalsScored > goalsConceded;
        const draw = goalsScored === goalsConceded;
        const cleanSheet = goalsConceded === 0;
        const isMotm = match.motm_player_id === vc.real_player_id;

        const basePoints = 
          (goalsScored || 0) * (SCORING_RULES.goals_scored || 0) +
          (cleanSheet ? (SCORING_RULES.clean_sheet || 0) : 0) +
          (isMotm ? (SCORING_RULES.motm || 0) : 0) +
          (won ? (SCORING_RULES.win || 0) : draw ? (SCORING_RULES.draw || 0) : 0) +
          (SCORING_RULES.match_played || 0) +
          (goalsScored >= 3 && SCORING_RULES.hat_trick ? SCORING_RULES.hat_trick : 0) +
          (goalsConceded >= 4 && SCORING_RULES.concedes_4_plus_goals ? SCORING_RULES.concedes_4_plus_goals : 0);

        const multiplier = 1.5; // Vice-Captain
        const multiplierInt = 150; // Store as integer (150 = 1.5x)
        const totalPoints = Math.round(basePoints * multiplier);

        // Insert record
        await fantasyDb`
          INSERT INTO fantasy_player_points (
            team_id, league_id, real_player_id, player_name,
            fixture_id, round_number, goals_scored, goals_conceded,
            is_clean_sheet, is_motm, result, total_points,
            is_captain, points_multiplier, base_points, calculated_at
          ) VALUES (
            ${vc.team_id}, ${vc.league_id}, ${vc.real_player_id}, ${vc.player_name},
            ${match.fixture_id}, ${match.round_number}, ${goalsScored}, ${goalsConceded},
            ${cleanSheet}, ${isMotm}, ${won ? 'win' : draw ? 'draw' : 'loss'}, ${totalPoints},
            true, ${multiplierInt}, ${basePoints}, NOW()
          )
        `;

        console.log(`    ✅ Inserted Round ${match.round_number}: ${basePoints} × 1.5 = ${totalPoints} pts`);
        inserted++;

        // Update squad total
        await fantasyDb`
          UPDATE fantasy_squad
          SET total_points = COALESCE(total_points, 0) + ${totalPoints}
          WHERE team_id = ${vc.team_id}
            AND real_player_id = ${vc.real_player_id}
        `;
      }
    }

    console.log(`\n\n📊 Summary:`);
    console.log(`  ✅ Inserted: ${inserted} records`);
    console.log(`  ⏭️  Skipped (already exist): ${skipped} records`);

    // Recalculate team totals
    console.log(`\n🔄 Recalculating team totals...`);
    
    const teams = await fantasyDb`SELECT team_id FROM fantasy_teams`;
    
    for (const team of teams) {
      const pointsResult = await fantasyDb`
        SELECT COALESCE(SUM(total_points), 0) as player_points
        FROM fantasy_player_points
        WHERE team_id = ${team.team_id}
      `;

      const teamInfo = await fantasyDb`
        SELECT COALESCE(passive_points, 0) as passive_points
        FROM fantasy_teams
        WHERE team_id = ${team.team_id}
      `;

      const playerPoints = Number(pointsResult[0].player_points);
      const passivePoints = Number(teamInfo[0].passive_points);
      const totalPoints = playerPoints + passivePoints;

      await fantasyDb`
        UPDATE fantasy_teams
        SET 
          player_points = ${playerPoints},
          total_points = ${totalPoints}
        WHERE team_id = ${team.team_id}
      `;
    }

    console.log(`✅ Team totals updated`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

fixMissingVCRecords()
  .then(() => {
    console.log('\n✅ Fix complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fix failed:', error);
    process.exit(1);
  });
