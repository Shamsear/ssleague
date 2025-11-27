import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

/**
 * GET /api/team/player-counts
 * Returns player counts for all teams in a season
 * 
 * Query params:
 * - seasonId: Season ID (required)
 * 
 * Returns:
 * {
 *   success: true,
 *   data: {
 *     [team_id]: {
 *       footballPlayersCount: number,
 *       realPlayersCount: number
 *     }
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('seasonId');

    if (!seasonId) {
      return NextResponse.json(
        { success: false, error: 'seasonId is required' },
        { status: 400 }
      );
    }

    const auctionDbUrl = process.env.NEON_AUCTION_DB_URL || process.env.NEON_DATABASE_URL;
    const tournamentDbUrl = process.env.NEON_TOURNAMENT_DB_URL;

    if (!auctionDbUrl || !tournamentDbUrl) {
      return NextResponse.json(
        { success: false, error: 'Database configuration missing' },
        { status: 500 }
      );
    }

    const auctionDb = neon(auctionDbUrl);
    const tournamentDb = neon(tournamentDbUrl);

    // Fetch football players count from auction DB
    const footballPlayerCounts = await auctionDb`
      SELECT 
        team_id,
        COUNT(*) as count
      FROM team_players
      WHERE season_id = ${seasonId}
      GROUP BY team_id
    `;

    // Fetch real players count from tournament DB
    const realPlayerCounts = await tournamentDb`
      SELECT 
        team_id,
        COUNT(*) as count
      FROM player_seasons
      WHERE season_id = ${seasonId}
        AND team_id IS NOT NULL
      GROUP BY team_id
    `;

    // Combine the results
    const playerCounts: { [key: string]: { footballPlayersCount: number; realPlayersCount: number } } = {};

    // Add football player counts
    footballPlayerCounts.forEach((row: any) => {
      if (!playerCounts[row.team_id]) {
        playerCounts[row.team_id] = { footballPlayersCount: 0, realPlayersCount: 0 };
      }
      playerCounts[row.team_id].footballPlayersCount = parseInt(row.count);
    });

    // Add real player counts
    realPlayerCounts.forEach((row: any) => {
      if (!playerCounts[row.team_id]) {
        playerCounts[row.team_id] = { footballPlayersCount: 0, realPlayersCount: 0 };
      }
      playerCounts[row.team_id].realPlayersCount = parseInt(row.count);
    });

    return NextResponse.json(
      {
        success: true,
        data: playerCounts,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching player counts:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch player counts',
      },
      { status: 500 }
    );
  }
}
