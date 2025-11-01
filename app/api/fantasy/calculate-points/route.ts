import { NextRequest, NextResponse } from 'next/server';
import { getFantasyDb } from '@/lib/neon/fantasy-config';
import { getTournamentDb } from '@/lib/neon/tournament-config';

/**
 * POST /api/fantasy/calculate-points
 * Calculate fantasy points for all drafted players in a fixture
 * Triggered automatically after fixture results are entered
 * 
 * Request body:
 * {
 *   fixture_id: string;
 *   season_id: string;
 *   round_number: number;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fixture_id, season_id, round_number } = body;

    if (!fixture_id || !season_id || round_number === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: fixture_id, season_id, round_number' },
        { status: 400 }
      );
    }

    const sql = getFantasyDb();

    // Get fantasy league for this season
    const leagues = await sql`
      SELECT id, status
      FROM fantasy_leagues
      WHERE season_id = ${season_id}
        AND status IN ('draft', 'active')
      LIMIT 1
    `;

    if (leagues.length === 0) {
      console.log('No active fantasy league found for season:', season_id);
      return NextResponse.json({
        success: true,
        message: 'No fantasy league exists for this season',
        points_calculated: 0,
      });
    }

    const fantasyLeague = leagues[0];
    const fantasy_league_id = fantasyLeague.id;

    // Activate league if still in draft
    if (fantasyLeague.status === 'draft') {
      await sql`
        UPDATE fantasy_leagues
        SET status = 'active', updated_at = NOW()
        WHERE id = ${fantasy_league_id}
      `;
    }

    // Get scoring rules for this league
    let rules = [];
    try {
      rules = await sql`
        SELECT rule_type, points_value
        FROM fantasy_scoring_rules
        WHERE league_id = ${fantasy_league_id}
          AND is_active = true
      `;
    } catch (error) {
      console.warn('Could not fetch scoring rules, using defaults');
    }

    // Use default rules if none found
    const scoringRules = new Map();
    if (rules.length > 0) {
      rules.forEach(rule => {
        scoringRules.set(rule.rule_type, rule.points_value);
      });
    } else {
      // Default scoring rules
      scoringRules.set('goals_scored', 5);
      scoringRules.set('goals_conceded', -1);
      scoringRules.set('win', 3);
      scoringRules.set('draw', 1);
      scoringRules.set('loss', 0);
      scoringRules.set('clean_sheet', 4);
      scoringRules.set('motm', 5);
      scoringRules.set('fine_goals', -2);
      scoringRules.set('substitution_penalty', -1);
    }

    // Fetch fixture data from Neon (includes MOTM)
    const fixtureResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/fixtures/${fixture_id}`);
    if (!fixtureResponse.ok) {
      return NextResponse.json(
        { error: 'Fixture not found' },
        { status: 404 }
      );
    }

    const { fixture: fixtureData } = await fixtureResponse.json();
    
    // Check if this tournament should be included in fantasy
    if (fixtureData.tournament_id) {
      try {
        const sql = getTournamentDb();
        const tournaments = await sql`
          SELECT include_in_fantasy 
          FROM tournaments 
          WHERE id = ${fixtureData.tournament_id}
        `;
        
        if (tournaments.length > 0 && tournaments[0].include_in_fantasy === false) {
          console.log(`Tournament ${fixtureData.tournament_id} is excluded from fantasy league`);
          return NextResponse.json({
            success: true,
            message: 'Tournament excluded from fantasy league',
            points_calculated: 0,
          });
        }
      } catch (error) {
        console.warn('Could not check tournament fantasy setting:', error);
        // Continue anyway if tournament check fails (backward compatibility)
      }
    }

    // Fetch matchup results from Neon
    const matchupsResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/fixtures/${fixture_id}/matchups`);
    if (!matchupsResponse.ok) {
      return NextResponse.json(
        { error: 'Matchups not found' },
        { status: 404 }
      );
    }

    const { matchups } = await matchupsResponse.json();

    if (!matchups || matchups.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No matchups found for this fixture',
        points_calculated: 0,
      });
    }

    // Process each player in the matchups
    const pointsCalculated: any[] = [];
    const teamPointsMap = new Map<string, number>();

    for (const matchup of matchups) {
      // Process home player
      await processPlayer({
        player_id: matchup.home_player_id,
        player_name: matchup.home_player_name,
        goals_scored: matchup.home_goals || 0,
        goals_conceded: matchup.away_goals || 0,
        result: matchup.home_goals > matchup.away_goals ? 'win' : 
                matchup.home_goals === matchup.away_goals ? 'draw' : 'loss',
        is_motm: fixtureData.motm_player_id === matchup.home_player_id,
        fine_goals: fixtureData.home_penalty_goals || 0,
        substitution_penalty: matchup.home_sub_penalty || 0,
        fantasy_league_id,
        fixture_id,
        round_number,
        scoringRules,
        sql,
        pointsCalculated,
        teamPointsMap,
      });

      // Process away player
      await processPlayer({
        player_id: matchup.away_player_id,
        player_name: matchup.away_player_name,
        goals_scored: matchup.away_goals || 0,
        goals_conceded: matchup.home_goals || 0,
        result: matchup.away_goals > matchup.home_goals ? 'win' : 
                matchup.away_goals === matchup.home_goals ? 'draw' : 'loss',
        is_motm: fixtureData.motm_player_id === matchup.away_player_id,
        fine_goals: fixtureData.away_penalty_goals || 0,
        substitution_penalty: matchup.away_sub_penalty || 0,
        fantasy_league_id,
        fixture_id,
        round_number,
        scoringRules,
        sql,
        pointsCalculated,
        teamPointsMap,
      });
    }

    // Update fantasy team totals (player points only)
    for (const [teamId, additionalPoints] of teamPointsMap.entries()) {
      await sql`
        UPDATE fantasy_teams
        SET 
          player_points = player_points + ${additionalPoints},
          total_points = total_points + ${additionalPoints},
          updated_at = NOW()
        WHERE id = ${teamId}
      `;
    }

    // Calculate team affiliation bonuses
    console.log('🎁 Calculating team affiliation bonuses...');
    try {
      const bonusResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/fantasy/calculate-team-bonuses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fixture_id, season_id, round_number }),
      });
      
      if (bonusResponse.ok) {
        const bonusData = await bonusResponse.json();
        console.log(`✅ Team bonuses: ${bonusData.message}`);
      }
    } catch (error) {
      console.error('Error calculating team bonuses:', error);
      // Don't fail the whole request if bonus calculation fails
    }

    // Recalculate ranks
    await recalculateLeaderboard(fantasy_league_id);

    return NextResponse.json({
      success: true,
      message: `Calculated fantasy points for ${pointsCalculated.length} players`,
      points_calculated: pointsCalculated,
    });
  } catch (error) {
    console.error('Error calculating fantasy points:', error);
    return NextResponse.json(
      { 
        error: 'Failed to calculate fantasy points',
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// Helper function to process a single player
async function processPlayer(params: {
  player_id: string;
  player_name: string;
  goals_scored: number;
  goals_conceded: number;
  result: 'win' | 'draw' | 'loss';
  is_motm: boolean;
  fine_goals: number;
  substitution_penalty: number;
  fantasy_league_id: string;
  fixture_id: string;
  round_number: number;
  scoringRules: Map<string, number>;
  sql: any;
  pointsCalculated: any[];
  teamPointsMap: Map<string, number>;
}) {
  const {
    player_id, player_name, goals_scored, goals_conceded, result,
    is_motm, fine_goals, substitution_penalty, fantasy_league_id,
    fixture_id, round_number, scoringRules, sql, pointsCalculated, teamPointsMap
  } = params;

  // Get ALL teams that have drafted this player
  const squads = await sql`
    SELECT team_id
    FROM fantasy_squad
    WHERE league_id = ${fantasy_league_id}
      AND real_player_id = ${player_id}
  `;

  if (squads.length === 0) {
    return; // Player not drafted by any team, skip
  }

  console.log(`Player ${player_name} is owned by ${squads.length} team(s)`);

  // Check if points already calculated for this player in this fixture for ANY team
  const existingPoints = await sql`
    SELECT id
    FROM fantasy_player_points
    WHERE league_id = ${fantasy_league_id}
      AND real_player_id = ${player_id}
      AND fixture_id = ${fixture_id}
    LIMIT 1
  `;

  if (existingPoints.length > 0) {
    console.log(`Points already calculated for player ${player_name} in fixture ${fixture_id}`);
    return; // Already calculated
  }

  // Calculate points breakdown (same for all teams)
  const is_clean_sheet = goals_conceded === 0;

  const points_breakdown: any = {
    goals: goals_scored * (scoringRules.get('goals_scored') || 0),
    conceded: goals_conceded * (scoringRules.get('goals_conceded') || 0),
    result: scoringRules.get(result) || 0,
    motm: is_motm ? (scoringRules.get('motm') || 0) : 0,
    fines: fine_goals * (scoringRules.get('fine_goals') || 0),
    clean_sheet: is_clean_sheet ? (scoringRules.get('clean_sheet') || 0) : 0,
    substitution: substitution_penalty > 0 ? (scoringRules.get('substitution_penalty') || 0) : 0,
  };
  
  // Conditional bonuses based on goal milestones
  if (goals_scored === 2) {
    points_breakdown.brace = scoringRules.get('brace') || 0;
  }
  if (goals_scored >= 3) {
    points_breakdown.hat_trick = scoringRules.get('hat_trick') || 0;
  }

  const total_points = Object.values(points_breakdown).reduce((sum, val) => sum + val, 0);

  // Award points to EACH team that owns this player
  for (const squad of squads) {
    const fantasy_team_id = squad.team_id;

    // Create fantasy_player_points record for this team
    await sql`
      INSERT INTO fantasy_player_points (
        league_id,
        team_id,
        real_player_id,
        player_name,
        fixture_id,
        round_number,
        goals_scored,
        goals_conceded,
        result,
        is_motm,
        fine_goals,
        substitution_penalty,
        is_clean_sheet,
        points_breakdown,
        total_points,
        calculated_at
      ) VALUES (
        ${fantasy_league_id},
        ${fantasy_team_id},
        ${player_id},
        ${player_name},
        ${fixture_id},
        ${round_number},
        ${goals_scored},
        ${goals_conceded},
        ${result},
        ${is_motm},
        ${fine_goals},
        ${substitution_penalty},
        ${is_clean_sheet},
        ${JSON.stringify(points_breakdown)},
        ${total_points},
        NOW()
      )
    `;

    // Track team points
    const currentTeamPoints = teamPointsMap.get(fantasy_team_id) || 0;
    teamPointsMap.set(fantasy_team_id, currentTeamPoints + total_points);

    pointsCalculated.push({
      player_id,
      player_name,
      fantasy_team_id,
      total_points,
      breakdown: points_breakdown,
    });
  }
}

// Helper function to recalculate leaderboard ranks
async function recalculateLeaderboard(fantasy_league_id: string) {
  try {
    const sql = getFantasyDb();
    
    // Get all teams ordered by points
    const teams = await sql`
      SELECT id
      FROM fantasy_teams
      WHERE league_id = ${fantasy_league_id}
      ORDER BY total_points DESC, id ASC
    `;

    // Update ranks
    for (let i = 0; i < teams.length; i++) {
      await sql`
        UPDATE fantasy_teams
        SET rank = ${i + 1}, updated_at = NOW()
        WHERE id = ${teams[i].id}
      `;
    }

    console.log(`✅ Leaderboard updated for league ${fantasy_league_id}`);
  } catch (error) {
    console.error('Error recalculating leaderboard:', error);
  }
}
