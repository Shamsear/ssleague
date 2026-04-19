import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

/**
 * GET /api/teams/[id]/matches
 * Get all matches (fixtures) for a specific team with match rewards tracking
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: teamId } = await context.params;
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('seasonId');

    if (!teamId) {
      return NextResponse.json(
        { success: false, error: 'Team ID is required' },
        { status: 400 }
      );
    }

    const sql = getTournamentDb();

    // Build query based on filters
    let query;
    if (seasonId) {
      query = await sql`
        SELECT 
          f.id as fixture_id,
          f.home_team_id,
          f.away_team_id,
          f.home_team_name,
          f.away_team_name,
          f.home_score,
          f.away_score,
          f.status,
          f.round_number,
          f.scheduled_date,
          f.created_at,
          f.season_id,
          f.tournament_id
        FROM fixtures f
        WHERE (f.home_team_id = ${teamId} OR f.away_team_id = ${teamId})
          AND f.season_id = ${seasonId}
          AND f.status = 'completed'
        ORDER BY f.round_number ASC, f.scheduled_date ASC
      `;
    } else {
      query = await sql`
        SELECT 
          f.id as fixture_id,
          f.home_team_id,
          f.away_team_id,
          f.home_team_name,
          f.away_team_name,
          f.home_score,
          f.away_score,
          f.status,
          f.round_number,
          f.scheduled_date,
          f.created_at,
          f.season_id,
          f.tournament_id
        FROM fixtures f
        WHERE (f.home_team_id = ${teamId} OR f.away_team_id = ${teamId})
          AND f.status = 'completed'
        ORDER BY f.round_number DESC, f.scheduled_date DESC
        LIMIT 100
      `;
    }

    // Transform the data to include opponent and result from team's perspective
    // Neon returns array directly, not query.rows
    const fixtures = Array.isArray(query) ? query : [];
    const matches = fixtures.map((fixture: any) => {
      const isHome = fixture.home_team_id === teamId;
      const opponentId = isHome ? fixture.away_team_id : fixture.home_team_id;
      const opponentName = isHome ? fixture.away_team_name : fixture.home_team_name;
      const teamScore = isHome ? fixture.home_score : fixture.away_score;
      const opponentScore = isHome ? fixture.away_score : fixture.home_score;

      // Determine result
      let result = 'Unknown';
      if (teamScore !== null && opponentScore !== null) {
        if (teamScore > opponentScore) {
          result = 'Win';
        } else if (teamScore < opponentScore) {
          result = 'Loss';
        } else {
          result = 'Draw';
        }
      }

      return {
        fixture_id: fixture.fixture_id,
        matchup_id: fixture.fixture_id, // Use fixture_id as matchup_id for consistency
        opponent_id: opponentId,
        opponent_name: opponentName,
        team_score: teamScore,
        opponent_score: opponentScore,
        result,
        round_number: fixture.round_number,
        match_date: fixture.scheduled_date || fixture.created_at,
        status: fixture.status,
        season_id: fixture.season_id,
        tournament_id: fixture.tournament_id,
        is_home: isHome
      };
    });

    return NextResponse.json({
      success: true,
      matches,
      count: matches.length
    });
  } catch (error) {
    console.error('Error fetching team matches:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch team matches',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
