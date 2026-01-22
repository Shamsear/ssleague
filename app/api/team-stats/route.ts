import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

/**
 * GET /api/team-stats
 * Fetch team stats by team_id and season_id
 * Query params: team_id (optional), season_id (required)
 * If team_id is not provided, returns all teams for the season
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('team_id');
    const seasonId = searchParams.get('season_id');

    if (!seasonId) {
      return NextResponse.json(
        { success: false, error: 'season_id is required' },
        { status: 400 }
      );
    }

    const sql = getTournamentDb();

    if (teamId) {
      // Fetch single team stats - get primary tournament stats
      const teamStats = await sql`
        SELECT 
          ts.id, ts.team_id, ts.team_name, ts.season_id, ts.tournament_id,
          ts.matches_played, ts.wins, ts.draws, ts.losses,
          ts.goals_for, ts.goals_against, ts.goal_difference,
          ts.points, ts.position,
          ts.created_at, ts.updated_at,
          t.tournament_name, t.is_primary
        FROM teamstats ts
        JOIN tournaments t ON ts.tournament_id = t.id
        WHERE ts.team_id = ${teamId} 
          AND ts.season_id = ${seasonId}
          AND t.is_primary = true
        LIMIT 1
      `;

      if (teamStats.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Team stats not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        stats: teamStats[0]
      });
    } else {
      // Fetch all teams stats for the season - get primary tournament only
      const allTeamStats = await sql`
        SELECT 
          ts.id, ts.team_id, ts.team_name, ts.season_id, ts.tournament_id,
          ts.matches_played, ts.wins, ts.draws, ts.losses,
          ts.goals_for, ts.goals_against, ts.goal_difference,
          ts.points, ts.position,
          ts.created_at, ts.updated_at,
          t.tournament_name
        FROM teamstats ts
        JOIN tournaments t ON ts.tournament_id = t.id
        WHERE ts.season_id = ${seasonId}
          AND t.is_primary = true
        ORDER BY ts.points DESC, ts.goal_difference DESC
      `;

      return NextResponse.json({
        success: true,
        teamStats: allTeamStats
      });
    }

  } catch (error: any) {
    console.error('Error fetching team stats:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch team stats' },
      { status: 500 }
    );
  }
}
