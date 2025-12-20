/**
 * Complete Fantasy Points Recalculation Script
 * 
 * This script performs a full recalculation of all fantasy points:
 * 1. Player points (from match performances with captain/VC multipliers)
 * 2. Passive team bonus points (from supported real team performance)
 * 3. Squad player totals
 * 4. Fantasy team totals and ranks
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function recalculateAllFantasyPoints() {
  const tournamentDb = neon(process.env.NEON_TOURNAMENT_DB_URL);
  const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);

  console.log('🎮 Starting Complete Fantasy Points Recalculation...\n');
  console.log('='.repeat(80));

  try {
    // ============================================================================
    // STEP 1: Recalculate Player Points
    // ============================================================================
    console.log('\n📊 STEP 1: Recalculating Player Points\n');
    
    // Fetch scoring rules
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

    console.log('✅ Loaded scoring rules');

    // Get completed fixtures
    const fixtures = await tournamentDb`
      SELECT 
        f.id as fixture_id,
        f.season_id,
        f.round_number,
        f.motm_player_id
      FROM fixtures f
      WHERE f.status = 'completed'
      ORDER BY f.round_number
    `;

    console.log(`✅ Found ${fixtures.length} completed fixtures`);

    // Get matchups
    const matchups = await tournamentDb`
      SELECT 
        m.fixture_id,
        m.home_player_id,
        m.home_player_name,
        m.away_player_id,
        m.away_player_name,
        m.home_goals,
        m.away_goals
      FROM matchups m
      JOIN fixtures f ON m.fixture_id = f.id
      WHERE f.status = 'completed'
        AND m.home_goals IS NOT NULL
        AND m.away_goals IS NOT NULL
    `;

    console.log(`✅ Found ${matchups.length} completed matchups`);

    // Get squad data
    const squadData = await fantasyDb`
      SELECT 
        real_player_id,
        team_id,
        player_name,
        is_captain,
        is_vice_captain
      FROM fantasy_squad
    `;

    const playerTeamsMap = new Map();
    squadData.forEach(row => {
      if (!playerTeamsMap.has(row.real_player_id)) {
        playerTeamsMap.set(row.real_player_id, []);
      }
      playerTeamsMap.get(row.real_player_id).push({
        teamId: row.team_id,
        isCaptain: row.is_captain || false,
        isViceCaptain: row.is_vice_captain || false,
        playerName: row.player_name
      });
    });

    console.log(`✅ Found ${squadData.length} squad entries`);

    // Clear existing player points
    console.log('🗑️  Clearing existing fantasy_player_points...');
    await fantasyDb`DELETE FROM fantasy_player_points`;
    console.log('✅ Cleared');

    // Calculate and insert points
    console.log('💯 Calculating player points...');
    
    let playerPointsInserted = 0;
    const fixtureMap = new Map();
    fixtures.forEach(f => fixtureMap.set(f.fixture_id, f));

    for (const matchup of matchups) {
      const fixture = fixtureMap.get(matchup.fixture_id);
      if (!fixture) continue;

      // Process both players
      for (const playerSide of ['home', 'away']) {
        const playerId = playerSide === 'home' ? matchup.home_player_id : matchup.away_player_id;
        const playerName = playerSide === 'home' ? matchup.home_player_name : matchup.away_player_name;
        const goalsScored = playerSide === 'home' ? matchup.home_goals : matchup.away_goals;
        const goalsConceded = playerSide === 'home' ? matchup.away_goals : matchup.home_goals;
        
        const won = goalsScored > goalsConceded;
        const draw = goalsScored === goalsConceded;
        const cleanSheet = goalsConceded === 0;
        const isMotm = fixture.motm_player_id === playerId;

        const basePoints = 
          (goalsScored || 0) * (SCORING_RULES.goals_scored || 0) +
          (cleanSheet ? (SCORING_RULES.clean_sheet || 0) : 0) +
          (isMotm ? (SCORING_RULES.motm || 0) : 0) +
          (won ? (SCORING_RULES.win || 0) : draw ? (SCORING_RULES.draw || 0) : 0) +
          (SCORING_RULES.match_played || 0) +
          (goalsScored >= 3 && SCORING_RULES.hat_trick ? SCORING_RULES.hat_trick : 0) +
          (goalsConceded >= 4 && SCORING_RULES.concedes_4_plus_goals ? SCORING_RULES.concedes_4_plus_goals : 0);

        const playerTeams = playerTeamsMap.get(playerId) || [];
        
        for (const teamInfo of playerTeams) {
          let multiplier = 1;
          let multiplierInt = 100; // Store as integer percentage
          if (teamInfo.isCaptain) {
            multiplier = 2;
            multiplierInt = 200;
          } else if (teamInfo.isViceCaptain) {
            multiplier = 1.5;
            multiplierInt = 150;
          }
          
          const totalPoints = Math.round(basePoints * multiplier);

          try {
            const teamInfo_full = await fantasyDb`
              SELECT league_id FROM fantasy_teams WHERE team_id = ${teamInfo.teamId} LIMIT 1
            `;
            const league_id = teamInfo_full[0]?.league_id;

            // Check if record already exists to prevent duplicates
            const existing = await fantasyDb`
              SELECT id FROM fantasy_player_points
              WHERE team_id = ${teamInfo.teamId}
                AND real_player_id = ${playerId}
                AND fixture_id = ${matchup.fixture_id}
              LIMIT 1
            `;

            if (existing.length === 0) {
              await fantasyDb`
                INSERT INTO fantasy_player_points (
                  team_id, league_id, real_player_id, player_name,
                  fixture_id, round_number, goals_scored, goals_conceded,
                  is_clean_sheet, is_motm, result, total_points,
                  is_captain, points_multiplier, base_points, calculated_at
                ) VALUES (
                  ${teamInfo.teamId}, ${league_id}, ${playerId}, ${playerName},
                  ${matchup.fixture_id}, ${fixture.round_number}, ${goalsScored}, ${goalsConceded},
                  ${cleanSheet}, ${isMotm}, ${won ? 'win' : draw ? 'draw' : 'loss'}, ${totalPoints},
                  ${teamInfo.isCaptain || teamInfo.isViceCaptain}, ${multiplierInt}, ${basePoints}, NOW()
                )
              `;
              playerPointsInserted++;
            }
          } catch (error) {
            // Skip errors silently
          }
        }
      }
    }

    console.log(`✅ Inserted ${playerPointsInserted} player point records\n`);

    // ============================================================================
    // STEP 2: Recalculate Passive Team Bonus Points
    // ============================================================================
    console.log('📊 STEP 2: Recalculating Passive Team Bonus Points\n');

    // Get active leagues
    const leagues = await fantasyDb`
      SELECT id, league_id, season_id
      FROM fantasy_leagues
      WHERE is_active = true
    `;

    console.log(`✅ Found ${leagues.length} active league(s)`);

    // Reset passive points
    for (const league of leagues) {
      await fantasyDb`
        UPDATE fantasy_teams
        SET 
          total_points = total_points - COALESCE(passive_points, 0),
          passive_points = 0
        WHERE league_id = ${league.league_id}
          AND passive_points > 0
      `;
    }
    console.log('✅ Reset passive points');

    // Delete existing bonus records
    await fantasyDb`DELETE FROM fantasy_team_bonus_points`;
    console.log('✅ Cleared bonus records');

    let totalBonusesAwarded = 0;

    for (const league of leagues) {
      // Get team scoring rules
      const teamRules = await fantasyDb`
        SELECT rule_type, points_value
        FROM fantasy_scoring_rules
        WHERE league_id = ${league.league_id}
          AND applies_to = 'team'
          AND is_active = true
      `;

      if (teamRules.length === 0) continue;

      const teamScoringRules = new Map();
      teamRules.forEach(rule => teamScoringRules.set(rule.rule_type, rule.points_value));

      // Get completed fixtures for this season
      const seasonFixtures = await tournamentDb`
        SELECT 
          f.id as fixture_id,
          f.round_number,
          f.home_team_id,
          f.away_team_id,
          f.home_score,
          f.away_score
        FROM fixtures f
        WHERE f.season_id = ${league.season_id}
          AND f.status = 'completed'
        ORDER BY f.round_number
      `;

      for (const fixture of seasonFixtures) {
        // Award bonuses for home team
        const homeBonuses = await awardTeamBonus({
          fantasy_league_id: league.league_id,
          real_team_id: fixture.home_team_id,
          fixture_id: fixture.fixture_id,
          round_number: fixture.round_number,
          goals_scored: fixture.home_score,
          goals_conceded: fixture.away_score,
          teamScoringRules,
          fantasyDb,
        });

        // Award bonuses for away team
        const awayBonuses = await awardTeamBonus({
          fantasy_league_id: league.league_id,
          real_team_id: fixture.away_team_id,
          fixture_id: fixture.fixture_id,
          round_number: fixture.round_number,
          goals_scored: fixture.away_score,
          goals_conceded: fixture.home_score,
          teamScoringRules,
          fantasyDb,
        });

        totalBonusesAwarded += homeBonuses + awayBonuses;
      }
    }

    console.log(`✅ Awarded ${totalBonusesAwarded} total bonus points\n`);

    // ============================================================================
    // STEP 3: Recalculate Squad Player Totals
    // ============================================================================
    console.log('📊 STEP 3: Recalculating Squad Player Totals\n');

    const squadPlayers = await fantasyDb`
      SELECT squad_id, team_id, real_player_id
      FROM fantasy_squad
    `;

    let squadUpdated = 0;
    for (const player of squadPlayers) {
      const pointsResult = await fantasyDb`
        SELECT COALESCE(SUM(total_points), 0) as calculated_total
        FROM fantasy_player_points
        WHERE team_id = ${player.team_id}
          AND real_player_id = ${player.real_player_id}
      `;

      // Get admin bonus points for this player
      const teamInfo = await fantasyDb`
        SELECT league_id FROM fantasy_teams WHERE team_id = ${player.team_id} LIMIT 1
      `;
      const leagueId = teamInfo[0]?.league_id;

      const playerBonusPoints = await fantasyDb`
        SELECT COALESCE(SUM(points), 0) as bonus_points
        FROM bonus_points
        WHERE target_type = 'player'
          AND target_id = ${player.real_player_id}
          AND league_id = ${leagueId}
      `;

      const calculatedTotal = Number(pointsResult[0].calculated_total);
      const adminBonusPoints = Number(playerBonusPoints[0].bonus_points);
      const totalWithBonus = calculatedTotal + adminBonusPoints;

      await fantasyDb`
        UPDATE fantasy_squad
        SET total_points = ${totalWithBonus}
        WHERE squad_id = ${player.squad_id}
      `;
      squadUpdated++;
    }

    console.log(`✅ Updated ${squadUpdated} squad player totals\n`);

    // ============================================================================
    // STEP 4: Recalculate Fantasy Team Totals and Ranks
    // ============================================================================
    console.log('📊 STEP 4: Recalculating Fantasy Team Totals and Ranks\n');

    const teams = await fantasyDb`
      SELECT team_id, team_name, league_id
      FROM fantasy_teams
      ORDER BY team_name
    `;

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

      // Get admin bonus points for this team
      // Note: bonus_points.target_id stores supported_team_id (real team), not fantasy team_id
      const teamWithSupport = await fantasyDb`
        SELECT supported_team_id
        FROM fantasy_teams
        WHERE team_id = ${team.team_id}
      `;
      
      const supportedTeamId = teamWithSupport[0]?.supported_team_id;
      
      const teamBonusPoints = await fantasyDb`
        SELECT COALESCE(SUM(points), 0) as bonus_points
        FROM bonus_points
        WHERE target_type = 'team'
          AND target_id = ${supportedTeamId}
          AND league_id = ${team.league_id}
      `;

      const playerPoints = Number(pointsResult[0].player_points);
      const passivePointsFromBonuses = Number(teamInfo[0].passive_points);
      const adminBonusPoints = Number(teamBonusPoints[0].bonus_points);
      const totalPassivePoints = passivePointsFromBonuses + adminBonusPoints;
      const calculatedTotal = playerPoints + totalPassivePoints;

      await fantasyDb`
        UPDATE fantasy_teams
        SET 
          player_points = ${playerPoints},
          passive_points = ${totalPassivePoints},
          total_points = ${calculatedTotal},
          updated_at = NOW()
        WHERE team_id = ${team.team_id}
      `;
    }

    console.log(`✅ Updated ${teams.length} team totals`);

    // Recalculate ranks
    const allLeagues = await fantasyDb`
      SELECT DISTINCT league_id FROM fantasy_teams
    `;

    for (const league of allLeagues) {
      await fantasyDb`
        WITH ranked_teams AS (
          SELECT 
            team_id,
            ROW_NUMBER() OVER (ORDER BY total_points DESC, team_name ASC) as new_rank
          FROM fantasy_teams
          WHERE league_id = ${league.league_id}
        )
        UPDATE fantasy_teams ft
        SET rank = rt.new_rank
        FROM ranked_teams rt
        WHERE ft.team_id = rt.team_id
      `;
    }

    console.log(`✅ Updated ranks for ${allLeagues.length} league(s)\n`);

    // ============================================================================
    // FINAL SUMMARY
    // ============================================================================
    // Get admin bonus points summary
    const adminBonusSummary = await fantasyDb`
      SELECT 
        target_type,
        COUNT(*) as count,
        SUM(points) as total_points
      FROM bonus_points
      GROUP BY target_type
    `;

    console.log('='.repeat(80));
    console.log('\n🎉 Complete Fantasy Points Recalculation Finished!\n');
    console.log('📊 Summary:');
    console.log(`  ✅ Player point records: ${playerPointsInserted}`);
    console.log(`  ✅ Passive bonus points: ${totalBonusesAwarded}`);
    console.log(`  ✅ Squad players updated: ${squadUpdated}`);
    console.log(`  ✅ Teams updated: ${teams.length}`);
    console.log(`  ✅ Leagues ranked: ${allLeagues.length}`);
    
    if (adminBonusSummary.length > 0) {
      console.log('\n🎁 Admin Bonus Points Applied:');
      adminBonusSummary.forEach(b => {
        console.log(`  ✅ ${b.target_type}: ${b.count} award(s), ${b.total_points > 0 ? '+' : ''}${b.total_points} pts total`);
      });
    }

    // Show top 10 teams
    console.log('\n🏆 Top 10 Teams:');
    const topTeams = await fantasyDb`
      SELECT rank, team_name, total_points, player_points, passive_points
      FROM fantasy_teams
      ORDER BY total_points DESC
      LIMIT 10
    `;
    console.table(topTeams);

  } catch (error) {
    console.error('❌ Error:', error);
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
    fantasyDb,
  } = params;

  const fantasyTeams = await fantasyDb`
    SELECT team_id, team_name, supported_team_id, supported_team_name
    FROM fantasy_teams
    WHERE league_id = ${fantasy_league_id}
      AND supported_team_id LIKE ${real_team_id + '_%'}
  `;

  if (fantasyTeams.length === 0) return 0;

  // ENHANCED: Calculate bonuses based on ALL configured rules dynamically
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
        // Unknown rule type - skip silently
        applies = false;
    }

    if (applies) {
      bonus_breakdown[ruleType] = points;
      total_bonus += points;
    }
  });

  if (total_bonus === 0) return 0;

  let totalAwarded = 0;

  for (const fantasyTeam of fantasyTeams) {
    const existing = await fantasyDb`
      SELECT id FROM fantasy_team_bonus_points
      WHERE league_id = ${fantasy_league_id}
        AND team_id = ${fantasyTeam.team_id}
        AND fixture_id = ${fixture_id}
      LIMIT 1
    `;

    if (existing.length > 0) continue;

    await fantasyDb`
      INSERT INTO fantasy_team_bonus_points (
        league_id, team_id, real_team_id, real_team_name,
        fixture_id, round_number, bonus_breakdown, total_bonus, calculated_at
      ) VALUES (
        ${fantasy_league_id}, ${fantasyTeam.team_id}, ${real_team_id},
        ${fantasyTeam.supported_team_name}, ${fixture_id}, ${round_number},
        ${JSON.stringify(bonus_breakdown)}, ${total_bonus}, NOW()
      )
    `;

    await fantasyDb`
      UPDATE fantasy_teams
      SET
        passive_points = passive_points + ${total_bonus},
        total_points = total_points + ${total_bonus},
        updated_at = NOW()
      WHERE team_id = ${fantasyTeam.team_id}
    `;

    totalAwarded += total_bonus;
  }

  return totalAwarded;
}

// Run the script
if (require.main === module) {
  recalculateAllFantasyPoints()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { recalculateAllFantasyPoints };
