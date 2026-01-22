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

    if (!seasonId) {
      return NextResponse.json(
        { success: false, error: 'season_id is required' },
        { status: 400 }
      );
    }

    // Get team stats from teamstats table - primary tournament only
    const teamStats = await sql`
      SELECT 
        ts.team_id,
        ts.team_name,
        ts.tournament_id,
        ts.season_id,
        ts.matches_played,
        ts.wins,
        ts.draws,
        ts.losses,
        ts.goals_for,
        ts.goals_against,
        ts.goal_difference,
        ts.points,
        ts.position,
        t.tournament_name
      FROM teamstats ts
      JOIN tournaments t ON ts.tournament_id = t.id
      WHERE ts.team_id = ${teamId}
        AND ts.season_id = ${seasonId}
        AND t.is_primary = true
      LIMIT 1
    `;

    if (teamStats.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Team stats not found for this season'
      }, { status: 404 });
    }

    const stats = teamStats[0];

    return NextResponse.json({
      success: true,
      standings: {
        position: stats.position || 0,
        played: stats.matches_played || 0,
        won: stats.wins || 0,
        drawn: stats.draws || 0,
        lost: stats.losses || 0,
        goalsFor: stats.goals_for || 0,
        goalsAgainst: stats.goals_against || 0,
        goalDifference: stats.goal_difference || 0,
        points: stats.points || 0
      }
    });
  } catch (error: any) {
    console.error('Error fetching team standings:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch standings' },
      { status: 500 }
    );
  }
}
