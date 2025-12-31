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
      // Fetch single team stats
      const teamStats = await sql`
        SELECT 
          id, team_id, team_name, season_id,
          matches_played, wins, draws, losses,
          goals_for, goals_against, goal_difference,
          points, position,
          created_at, updated_at
        FROM teamstats
        WHERE team_id = ${teamId} AND season_id = ${seasonId}
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
      // Fetch all teams stats for the season
      const allTeamStats = await sql`
        SELECT 
          id, team_id, team_name, season_id,
          matches_played, wins, draws, losses,
          goals_for, goals_against, goal_difference,
          points, position,
          created_at, updated_at
        FROM teamstats
        WHERE season_id = ${seasonId}
        ORDER BY points DESC, goal_difference DESC
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
