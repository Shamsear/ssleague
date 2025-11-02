import { NextRequest, NextResponse } from 'next/server';
import { getFantasyDb } from '@/lib/neon/fantasy-config';

/**
 * GET /api/fantasy/fixtures/[fixtureId]/points-breakdown?league_id=xxx
 * Get detailed fantasy points breakdown for all players in a fixture
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { fixtureId: string } }
) {
  try {
    const { fixtureId } = params;
    const { searchParams } = new URL(request.url);
    const league_id = searchParams.get('league_id');

    if (!league_id) {
      return NextResponse.json(
        { error: 'league_id parameter is required' },
        { status: 400 }
      );
    }

    const sql = getFantasyDb();

    // Get all fantasy points for this fixture
    const points = await sql`
      SELECT 
        fpp.*,
        ft.team_name as fantasy_team_name
      FROM fantasy_player_points fpp
      JOIN fantasy_teams ft ON fpp.team_id = ft.team_id
      WHERE fpp.fixture_id = ${fixtureId}
        AND fpp.league_id = ${league_id}
      ORDER BY ft.team_name, fpp.total_points DESC
    `;

    if (points.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No points calculated for this fixture yet',
        breakdown: [],
      });
    }

    // Format the breakdown
    const breakdown = points.map((p: any) => {
      const pointsBreakdown = typeof p.points_breakdown === 'string' 
        ? JSON.parse(p.points_breakdown) 
        : p.points_breakdown;

      return {
        fantasy_team_name: p.fantasy_team_name,
        player_name: p.player_name,
        goals_scored: p.goals_scored,
        goals_conceded: p.goals_conceded,
        result: p.result,
        is_motm: p.is_motm,
        is_clean_sheet: p.is_clean_sheet,
        fine_goals: p.fine_goals,
        substitution_penalty: p.substitution_penalty,
        breakdown: pointsBreakdown,
        base_points: p.base_points,
        is_captain: p.is_captain,
        points_multiplier: p.points_multiplier,
        final_points: p.total_points,
        calculated_at: p.calculated_at,
      };
    });

    // Group by team
    const byTeam: any = {};
    breakdown.forEach((item: any) => {
      if (!byTeam[item.fantasy_team_name]) {
        byTeam[item.fantasy_team_name] = {
          team_name: item.fantasy_team_name,
          players: [],
          total_points: 0,
        };
      }
      byTeam[item.fantasy_team_name].players.push(item);
      byTeam[item.fantasy_team_name].total_points += item.final_points;
    });

    return NextResponse.json({
      success: true,
      fixture_id: fixtureId,
      league_id,
      breakdown: breakdown,
      by_team: Object.values(byTeam),
    });
  } catch (error) {
    console.error('Error fetching points breakdown:', error);
    return NextResponse.json(
      { error: 'Failed to fetch points breakdown' },
      { status: 500 }
    );
  }
}
