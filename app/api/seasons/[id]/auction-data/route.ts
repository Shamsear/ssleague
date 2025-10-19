import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/neon/config';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: seasonId } = await params;

    if (!seasonId) {
      return NextResponse.json(
        { success: false, message: 'Season ID is required' },
        { status: 400 }
      );
    }

    // Fetch rounds for this season
    const rounds = await sql`
      SELECT 
        id, 
        season_id, 
        position, 
        round_number,
        max_bids_per_team, 
        end_time, 
        status,
        created_at
      FROM rounds 
      WHERE season_id = ${seasonId}
      ORDER BY round_number ASC
    `;

    // Fetch all bids for this season's rounds
    const roundIds = rounds.map(r => r.id);
    let bids = [];
    let topBids = [];
    
    if (roundIds.length > 0) {
      // Get all bids
      bids = await sql`
        SELECT 
          b.id,
          b.team_id,
          b.player_id,
          b.round_id,
          b.amount,
          b.status,
          b.created_at,
          fp.name as player_name,
          fp.position as player_position
        FROM bids b
        LEFT JOIN footballplayers fp ON b.player_id = fp.player_id
        WHERE b.round_id = ANY(${roundIds})
        ORDER BY b.created_at DESC
      `;

      // Get top 10 bids
      topBids = await sql`
        SELECT 
          b.amount,
          b.status,
          b.team_id,
          fp.name as player_name,
          fp.position as player_position,
          fp.team_name as player_team,
          r.round_number
        FROM bids b
        LEFT JOIN footballplayers fp ON b.player_id = fp.player_id
        LEFT JOIN rounds r ON b.round_id = r.id
        WHERE b.round_id = ANY(${roundIds}) AND b.status = 'won'
        ORDER BY b.amount DESC
        LIMIT 10
      `;
    }

    // Fetch team players (acquired players)
    const teamPlayers = await sql`
      SELECT 
        tp.id,
        tp.team_id,
        tp.player_id,
        tp.purchase_price,
        tp.acquired_at,
        fp.name as player_name,
        fp.position as player_position
      FROM team_players tp
      LEFT JOIN footballplayers fp ON tp.player_id = fp.player_id
      WHERE fp.season_id = ${seasonId}
      ORDER BY tp.acquired_at DESC
    `;

    // Calculate statistics
    const stats = {
      totalRounds: rounds.length,
      totalBids: bids.length,
      activeRounds: rounds.filter((r: any) => r.status === 'active').length,
      completedRounds: rounds.filter((r: any) => r.status === 'completed').length,
      wonBids: bids.filter((b: any) => b.status === 'won').length,
      totalAcquiredPlayers: teamPlayers.length,
    };

    // Add bid counts to rounds
    const roundsWithBids = rounds.map((round: any) => {
      const roundBids = bids.filter((b: any) => b.round_id === round.id);
      return {
        ...round,
        bidCount: roundBids.length,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        rounds: roundsWithBids,
        bids,
        topBids,
        teamPlayers,
        stats,
      },
    });
  } catch (error: any) {
    console.error('Error fetching auction data:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch auction data',
        error: error.message 
      },
      { status: 500 }
    );
  }
}
