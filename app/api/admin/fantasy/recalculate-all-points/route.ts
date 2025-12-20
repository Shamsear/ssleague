import { NextRequest, NextResponse } from 'next/server';
import { getFantasyDb } from '@/lib/neon/fantasy-config';
import { getTournamentDb } from '@/lib/neon/tournament-config';

/**
 * POST /api/admin/fantasy/recalculate-all-points
 * Complete recalculation of all fantasy points
 */
export async function POST(request: NextRequest) {
  try {
    const fantasyDb = getFantasyDb();
    const tournamentDb = getTournamentDb();

    console.log('🎮 Starting Complete Fantasy Points Recalculation...');

    const results = {
      playerPointsInserted: 0,
      passiveBonusesAwarded: 0,
      squadPlayersUpdated: 0,
      teamsUpdated: 0,
      leaguesRanked: 0,
    };

    // ============================================================================
    // STEP 1: Recalculate Player Points
    // ============================================================================
    console.log('📊 STEP 1: Recalculating Player Points');
    
    // Fetch scoring rules
    const scoringRulesData = await fantasyDb`
      SELECT rule_type, points_value, applies_to
      FROM fantasy_scoring_rules
      WHERE is_active = true
    `;

    const SCORING_RULES: Record<string, number> = {};
    scoringRulesData.forEach((rule: any) => {
      if (rule.applies_to === 'player') {
        SCORING_RULES[rule.rule_type.toLowerCase()] = rule.points_value;
      }
    });

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
    squadData.forEach((row: any) => {
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

    // Clear existing player points
    await fantasyDb`DELETE FROM fantasy_player_points`;

    // Calculate and insert points
    const fixtureMap = new Map();
    fixtures.forEach((f: any) => fixtureMap.set(f.fixture_id, f));

    for (const matchup of matchups as any[]) {
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
              results.playerPointsInserted++;
            }
          } catch (error) {
            // Skip errors
          }
        }
      }
    }

    // ============================================================================
    // STEP 2: Recalculate Passive Team Bonus Points
    // ============================================================================
    console.log('📊 STEP 2: Recalculating Passive Team Bonus Points');

    const leagues = await fantasyDb`
      SELECT id, league_id, season_id
      FROM fantasy_leagues
      WHERE is_active = true
    `;

    // Reset passive points
    for (const league of leagues as any[]) {
      await fantasyDb`
        UPDATE fantasy_teams
        SET 
          total_points = total_points - COALESCE(passive_points, 0),
          passive_points = 0
        WHERE league_id = ${league.league_id}
          AND passive_points > 0
      `;
    }

    // Delete existing bonus records
    await fantasyDb`DELETE FROM fantasy_team_bonus_points`;

    for (const league of leagues as any[]) {
      const teamRules = await fantasyDb`
        SELECT rule_type, points_value
        FROM fantasy_scoring_rules
        WHERE league_id = ${league.league_id}
          AND applies_to = 'team'
          AND is_active = true
      `;

      if (teamRules.length === 0) continue;

      const teamScoringRules = new Map();
      teamRules.forEach((rule: any) => teamScoringRules.set(rule.rule_type, rule.points_value));

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

      for (const fixture of seasonFixtures as any[]) {
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

        results.passiveBonusesAwarded += homeBonuses + awayBonuses;
      }
    }

    // ============================================================================
    // STEP 3: Recalculate Squad Player Totals
    // ============================================================================
    console.log('📊 STEP 3: Recalculating Squad Player Totals');

    const squadPlayers = await fantasyDb`
      SELECT squad_id, team_id, real_player_id
      FROM fantasy_squad
    `;

    for (const player of squadPlayers as any[]) {
      const pointsResult = await fantasyDb`
        SELECT COALESCE(SUM(total_points), 0) as calculated_total
        FROM fantasy_player_points
        WHERE team_id = ${player.team_id}
          AND real_player_id = ${player.real_player_id}
      `;

      await fantasyDb`
        UPDATE fantasy_squad
        SET total_points = ${pointsResult[0].calculated_total}
        WHERE squad_id = ${player.squad_id}
      `;
      results.squadPlayersUpdated++;
    }

    // ============================================================================
    // STEP 4: Recalculate Fantasy Team Totals and Ranks
    // ============================================================================
    console.log('📊 STEP 4: Recalculating Fantasy Team Totals and Ranks');

    const teams = await fantasyDb`
      SELECT team_id, team_name, league_id
      FROM fantasy_teams
      ORDER BY team_name
    `;

    for (const team of teams as any[]) {
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
      const calculatedTotal = playerPoints + passivePoints;

      await fantasyDb`
        UPDATE fantasy_teams
        SET 
          player_points = ${playerPoints},
          total_points = ${calculatedTotal},
          updated_at = NOW()
        WHERE team_id = ${team.team_id}
      `;
      results.teamsUpdated++;
    }

    // Recalculate ranks
    const allLeagues = await fantasyDb`
      SELECT DISTINCT league_id FROM fantasy_teams
    `;

    for (const league of allLeagues as any[]) {
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
      results.leaguesRanked++;
    }

    return NextResponse.json({
      success: true,
      message: 'Fantasy points recalculation completed successfully',
      results,
    });

  } catch (error) {
    console.error('Error recalculating fantasy points:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to recalculate fantasy points',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function awardTeamBonus(params: {
  fantasy_league_id: string;
  real_team_id: string;
  fixture_id: string;
  round_number: number;
  goals_scored: number;
  goals_conceded: number;
  teamScoringRules: Map<string, number>;
  fantasyDb: any;
}) {
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

  const won = goals_scored > goals_conceded;
  const draw = goals_scored === goals_conceded;
  const lost = goals_scored < goals_conceded;
  const clean_sheet = goals_conceded === 0;
  const high_scoring = goals_scored >= 4;

  const bonus_breakdown: any = {};
  let total_bonus = 0;

  if (won && teamScoringRules.has('win')) {
    bonus_breakdown.win = teamScoringRules.get('win')!;
    total_bonus += bonus_breakdown.win;
  }
  if (draw && teamScoringRules.has('draw')) {
    bonus_breakdown.draw = teamScoringRules.get('draw')!;
    total_bonus += bonus_breakdown.draw;
  }
  if (lost && teamScoringRules.has('loss')) {
    bonus_breakdown.loss = teamScoringRules.get('loss')!;
    total_bonus += bonus_breakdown.loss;
  }
  if (clean_sheet && teamScoringRules.has('clean_sheet')) {
    bonus_breakdown.clean_sheet = teamScoringRules.get('clean_sheet')!;
    total_bonus += bonus_breakdown.clean_sheet;
  }
  if (high_scoring && teamScoringRules.has('high_scoring')) {
    bonus_breakdown.high_scoring = teamScoringRules.get('high_scoring')!;
    total_bonus += bonus_breakdown.high_scoring;
  }

  if (total_bonus === 0) return 0;

  let totalAwarded = 0;

  for (const fantasyTeam of fantasyTeams as any[]) {
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
