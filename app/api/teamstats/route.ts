import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

// GET - Fetch team stats for a tournament
export async function GET(request: NextRequest) {
    try {
        const sql = getTournamentDb();
        const searchParams = request.nextUrl.searchParams;
        const tournamentId = searchParams.get('tournament_id');

        if (!tournamentId) {
            return NextResponse.json(
                { success: false, error: 'tournament_id is required' },
                { status: 400 }
            );
        }

        // Fetch team stats from database
        // Note: Using actual column names from teamstats table with aliases
        const teamStats = await sql`
      SELECT 
        team_id,
        team_name,
        matches_played as played,
        wins as won,
        draws as drawn,
        losses as lost,
        goals_for,
        goals_against,
        goal_difference,
        points,
        COALESCE(points_deducted, 0) as points_deducted
      FROM teamstats
      WHERE tournament_id = ${tournamentId}
      ORDER BY points DESC, goal_difference DESC, goals_for DESC
    `;

        return NextResponse.json({
            success: true,
            teamStats: teamStats,
        });
    } catch (error) {
        console.error('Error fetching team stats:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch team stats' },
            { status: 500 }
        );
    }
}
