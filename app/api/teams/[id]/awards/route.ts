import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

/**
 * GET /api/teams/[id]/awards
 * Fetch all awards for a specific team in a season
 * Query params:
 * - seasonId (optional): Filter by specific season
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: teamId } = await params;
        const { searchParams } = new URL(request.url);
        const seasonId = searchParams.get('seasonId');

        const sql = getTournamentDb();

        let awards;

        if (seasonId) {
            // Fetch awards for specific season
            awards = await sql`
        SELECT 
          id,
          award_type,
          tournament_id,
          season_id,
          round_number,
          week_number,
          player_id,
          player_name,
          team_id,
          team_name,
          performance_stats,
          selected_by_name,
          notes,
          created_at
        FROM awards
        WHERE team_id = ${teamId}
          AND season_id = ${seasonId}
        ORDER BY 
          CASE award_type
            WHEN 'season_player' THEN 1
            WHEN 'season_team' THEN 2
            WHEN 'potm' THEN 3
            WHEN 'totw' THEN 4
            ELSE 5
          END,
          round_number DESC,
          week_number DESC,
          created_at DESC
      `;
        } else {
            // Fetch all awards for this team
            awards = await sql`
        SELECT 
          id,
          award_type,
          tournament_id,
          season_id,
          round_number,
          week_number,
          player_id,
          player_name,
          team_id,
          team_name,
          performance_stats,
          selected_by_name,
          notes,
          created_at
        FROM awards
        WHERE team_id = ${teamId}
        ORDER BY 
          season_id DESC,
          CASE award_type
            WHEN 'season_player' THEN 1
            WHEN 'season_team' THEN 2
            WHEN 'potm' THEN 3
            WHEN 'totw' THEN 4
            ELSE 5
          END,
          round_number DESC,
          week_number DESC,
          created_at DESC
      `;
        }

        // Group awards by type
        const groupedAwards = {
            season: awards.filter((a: any) => a.award_type === 'season_player' || a.award_type === 'season_team'),
            potm: awards.filter((a: any) => a.award_type === 'potm'),
            totw: awards.filter((a: any) => a.award_type === 'totw'),
            other: awards.filter((a: any) => !['season_player', 'season_team', 'potm', 'totw'].includes(a.award_type))
        };

        return NextResponse.json({
            success: true,
            data: {
                awards,
                grouped: groupedAwards,
                count: awards.length
            },
            message: 'Awards fetched successfully'
        });

    } catch (error: any) {
        console.error('Error fetching team awards:', error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Failed to fetch team awards'
            },
            { status: 500 }
        );
    }
}
