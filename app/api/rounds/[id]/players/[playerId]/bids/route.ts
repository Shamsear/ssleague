import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_DATABASE_URL!);

/**
 * GET /api/rounds/[id]/players/[playerId]/bids
 * Fetch all bids for a specific player in a bulk round
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; playerId: string }> }
) {
  try {
    const { id: roundId, playerId } = await params;

    // Fetch bids for this player in this round
    const bids = await sql`
      SELECT 
        rb.id,
        rb.round_id,
        rb.player_id,
        rb.team_id,
        rb.bid_amount as amount,
        rb.bid_time as created_at,
        rb.is_winning,
        t.name as team_name
      FROM round_bids rb
      INNER JOIN teams t ON rb.team_id = t.id
      WHERE rb.round_id::text = ${roundId}
        AND rb.player_id = ${playerId}
      ORDER BY rb.bid_amount DESC, rb.bid_time ASC
    `;

    return NextResponse.json({
      success: true,
      data: bids,
    });
  } catch (error: any) {
    console.error('Error fetching player bids:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
