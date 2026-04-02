import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL!);

export async function GET(
  request: NextRequest,
  { params }: { params: { teamId: string } }
) {
  try {
    const { teamId } = params;
    const searchParams = request.nextUrl.searchParams;
    const seasonId = searchParams.get('season_id');

    if (!seasonId) {
      return NextResponse.json(
        { success: false, error: 'Season ID is required' },
        { status: 400 }
      );
    }

    // Get team stats by tournament
    const tournamentStats = await sql`
      SELECT 
        tournament_id,
        COUNT(*) as matches_played,
        SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN result = 'draw' THEN 1 ELSE 0 END) as draws,
        SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) as losses,
        SUM(goals_scored) as goals_scored,
        SUM(goals_conceded) as goals_conceded,
        SUM(points) as points,
        SUM(CASE WHEN clean_sheet = true THEN 1 ELSE 0 END) as clean_sheets
      FROM teamstats
      WHERE team_id = ${teamId}
        AND season_id = ${seasonId}
      GROUP BY tournament_id
      ORDER BY tournament_id
    `;

    // Get overall stats
    const overallStats = await sql`
      SELECT 
        COUNT(*) as matches_played,
        SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN result = 'draw' THEN 1 ELSE 0 END) as draws,
        SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) as losses,
        SUM(goals_scored) as goals_scored,
        SUM(goals_conceded) as goals_conceded,
        SUM(points) as points,
        SUM(CASE WHEN clean_sheet = true THEN 1 ELSE 0 END) as clean_sheets
      FROM teamstats
      WHERE team_id = ${teamId}
        AND season_id = ${seasonId}
    `;

    // Get tournament names from tournaments table
    const tournaments = await sql`
      SELECT id, name, type
      FROM tournaments
      WHERE season_id = ${seasonId}
      ORDER BY created_at
    `;

    // Map tournament IDs to names
    const tournamentMap = tournaments.reduce((acc: any, t: any) => {
      acc[t.id] = { name: t.name, type: t.type };
      return acc;
    }, {});

    // Enhance tournament stats with names
    const enhancedTournamentStats = tournamentStats.map((stat: any) => ({
      ...stat,
      tournament_name: tournamentMap[stat.tournament_id]?.name || stat.tournament_id,
      tournament_type: tournamentMap[stat.tournament_id]?.type || 'unknown',
      win_rate: stat.matches_played > 0 
        ? ((stat.wins / stat.matches_played) * 100).toFixed(1)
        : '0.0',
      goals_per_game: stat.matches_played > 0
        ? (stat.goals_scored / stat.matches_played).toFixed(2)
        : '0.00',
      conceded_per_game: stat.matches_played > 0
        ? (stat.goals_conceded / stat.matches_played).toFixed(2)
        : '0.00',
      goal_difference: stat.goals_scored - stat.goals_conceded
    }));

    const overall = overallStats[0] || {
      matches_played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goals_scored: 0,
      goals_conceded: 0,
      points: 0,
      clean_sheets: 0
    };

    const enhancedOverall = {
      ...overall,
      win_rate: overall.matches_played > 0
        ? ((overall.wins / overall.matches_played) * 100).toFixed(1)
        : '0.0',
      goals_per_game: overall.matches_played > 0
        ? (overall.goals_scored / overall.matches_played).toFixed(2)
        : '0.00',
      conceded_per_game: overall.matches_played > 0
        ? (overall.goals_conceded / overall.matches_played).toFixed(2)
        : '0.00',
      goal_difference: overall.goals_scored - overall.goals_conceded
    };

    return NextResponse.json({
      success: true,
      data: {
        tournamentStats: enhancedTournamentStats,
        overallStats: enhancedOverall
      }
    });
  } catch (error) {
    console.error('Error fetching tournament stats:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch tournament stats',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
