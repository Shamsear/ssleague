import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { teamId } = await params;
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('season_id');
    const status = searchParams.get('status'); // 'scheduled', 'completed', etc.
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!seasonId) {
      return NextResponse.json(
        { success: false, error: 'season_id is required' },
        { status: 400 }
      );
    }

    // Fetch fixtures from Neon where team is either home or away
    let fixturesQuery = sql`
      SELECT 
        id,
        tournament_id,
        season_id,
        round_number,
        match_number,
        home_team_id,
        away_team_id,
        home_team_name,
        away_team_name,
        home_score,
        away_score,
        status,
        leg,
        group_name,
        knockout_round,
        created_at,
        updated_at
      FROM fixtures
      WHERE season_id = ${seasonId}
        AND (home_team_id = ${teamId} OR away_team_id = ${teamId})
    `;

    // Add status filter if provided
    if (status) {
      fixturesQuery = sql`
        SELECT 
          id,
          tournament_id,
          season_id,
          round_number,
          match_number,
          home_team_id,
          away_team_id,
          home_team_name,
          away_team_name,
          home_score,
          away_score,
          status,
          leg,
          group_name,
          knockout_round,
          created_at,
          updated_at
        FROM fixtures
        WHERE season_id = ${seasonId}
          AND (home_team_id = ${teamId} OR away_team_id = ${teamId})
          AND status = ${status}
        ORDER BY round_number ASC, match_number ASC
        LIMIT ${limit}
      `;
    } else {
      fixturesQuery = sql`
        SELECT 
          id,
          tournament_id,
          season_id,
          round_number,
          match_number,
          home_team_id,
          away_team_id,
          home_team_name,
          away_team_name,
          home_score,
          away_score,
          status,
          leg,
          group_name,
          knockout_round,
          created_at,
          updated_at
        FROM fixtures
        WHERE season_id = ${seasonId}
          AND (home_team_id = ${teamId} OR away_team_id = ${teamId})
        ORDER BY round_number ASC, match_number ASC
        LIMIT ${limit}
      `;
    }

    const fixtures = await fixturesQuery;

    return NextResponse.json({
      success: true,
      fixtures: fixtures,
      count: fixtures.length
    });
  } catch (error: any) {
    console.error('Error fetching team fixtures:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch fixtures' },
      { status: 500 }
    );
  }
}
