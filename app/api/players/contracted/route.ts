import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

/**
 * GET /api/players/contracted
 * Fetch all real players with active contracts for a season
 * 
 * Query params:
 * - seasonId: string (required)
 */
export async function GET(request: NextRequest) {
    try {
        const sql = getTournamentDb();
        const searchParams = request.nextUrl.searchParams;
        const seasonId = searchParams.get('seasonId');

        if (!seasonId) {
            return NextResponse.json(
                { success: false, error: 'seasonId is required' },
                { status: 400 }
            );
        }

        console.log('🔍 Fetching contracted players for season:', seasonId);

        // Fetch all players with contracts from player_seasons table
        const players = await sql`
      SELECT 
        id,
        player_id,
        player_name,
        team_id,
        team,
        auction_value,
        contract_start_season,
        contract_end_season,
        star_rating,
        points,
        category,
        matches_played,
        goals_scored,
        assists
      FROM player_seasons
      WHERE season_id = ${seasonId}
        AND team_id IS NOT NULL
        AND auction_value IS NOT NULL
        AND contract_start_season IS NOT NULL
        AND contract_end_season IS NOT NULL
      ORDER BY team, player_name
    `;

        console.log('📊 Found contracted players:', players.length);

        return NextResponse.json({
            success: true,
            players,
            count: players.length
        });
    } catch (error: any) {
        console.error('Error fetching contracted players:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch contracted players',
                details: error.message
            },
            { status: 500 }
        );
    }
}
