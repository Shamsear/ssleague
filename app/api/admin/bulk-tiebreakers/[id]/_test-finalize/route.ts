/**
 * WARNING: DEVELOPMENT ONLY - NO AUTH
 * POST /api/admin/bulk-tiebreakers/:id/_test-finalize
 * Test endpoint to finalize without authentication
 * DELETE THIS FILE IN PRODUCTION
 */

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { finalizeBulkTiebreaker } from '@/lib/finalize-bulk-tiebreaker';
import { broadcastWebSocket, BroadcastType } from '@/lib/websocket/broadcast';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tiebreakerId } = await params;

    console.log(`🧪 TEST: Finalizing tiebreaker ${tiebreakerId}`);

    // Get tiebreaker details
    const tiebreakerCheck = await sql`
      SELECT 
        id, 
        player_name,
        player_position,
        status, 
        current_highest_bid,
        current_highest_team_id
      FROM bulk_tiebreakers
      WHERE id = ${tiebreakerId}
    `;

    if (tiebreakerCheck.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tiebreaker not found' },
        { status: 404 }
      );
    }

    const tiebreaker = tiebreakerCheck[0];

    // Check if already finalized
    if (tiebreaker.status === 'resolved' || tiebreaker.status === 'finalized') {
      return NextResponse.json(
        { success: false, error: 'Tiebreaker already finalized' },
        { status: 400 }
      );
    }

    // Call finalization
    const finalizeResult = await finalizeBulkTiebreaker(tiebreakerId);

    if (!finalizeResult.success) {
      return NextResponse.json(
        { success: false, error: finalizeResult.error },
        { status: 500 }
      );
    }

    // Broadcast
    const winnerTeamResult = await sql`
      SELECT team_name FROM bulk_tiebreaker_teams
      WHERE tiebreaker_id = ${tiebreakerId} 
      AND team_id = ${tiebreaker.current_highest_team_id}
    `;
    const winnerTeamName = winnerTeamResult[0]?.team_name || 'Unknown';

    await broadcastWebSocket(`tiebreaker:${tiebreakerId}`, {
      type: BroadcastType.TIEBREAKER_FINALIZED,
      data: {
        tiebreaker_id: tiebreakerId,
        player_name: tiebreaker.player_name,
        position: tiebreaker.player_position,
        winner_team_id: tiebreaker.current_highest_team_id,
        winner_team_name: winnerTeamName,
        final_bid: tiebreaker.current_highest_bid,
        status: 'resolved',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        tiebreaker_id: tiebreakerId,
        player_name: tiebreaker.player_name,
        winner_team_name: winnerTeamName,
        winning_amount: finalizeResult.winning_amount,
        message: `✅ Test finalization successful!`,
      },
    });

  } catch (error: any) {
    console.error('❌ Test finalize error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
