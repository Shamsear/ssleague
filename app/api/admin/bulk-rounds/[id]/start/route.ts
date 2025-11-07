import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '@/lib/auth-helper';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

// WebSocket broadcast function (set by WebSocket server)
declare global {
  var wsBroadcast: ((channel: string, data: any) => void) | undefined;
}

/**
 * POST /api/admin/bulk-rounds/:id/start
 * Start a bulk bidding round (set status to active, set start/end times)
 * Committee admin only
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ ZERO FIREBASE READS - Uses JWT claims only
    const auth = await verifyAuth(['admin', 'committee_admin'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: roundId } = await params;

    console.log(`🚀 Starting bulk round ${roundId}`);

    // Get round details
    const roundCheck = await sql`
      SELECT id, status, duration_seconds, round_number
      FROM rounds
      WHERE id = ${roundId}
      AND round_type = 'bulk'
    `;

    if (roundCheck.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Bulk round not found' },
        { status: 404 }
      );
    }

    const round = roundCheck[0];

    if (round.status !== 'draft') {
      return NextResponse.json(
        { success: false, error: `Cannot start round. Current status: ${round.status}` },
        { status: 400 }
      );
    }

    // Start the round using UTC (same as normal rounds)
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + (round.duration_seconds * 1000));

    await sql`
      UPDATE rounds
      SET 
        status = 'active',
        start_time = ${startTime.toISOString()},
        end_time = ${endTime.toISOString()},
        updated_at = NOW()
      WHERE id = ${roundId}
    `;

    console.log(`✅ Bulk round ${round.round_number} started`);
    console.log(`⏰ Start (UTC): ${startTime.toISOString()}`);
    console.log(`⏰ End (UTC): ${endTime.toISOString()}`);
    console.log(`⏰ Duration: ${round.duration_seconds} seconds (${Math.floor(round.duration_seconds / 60)} minutes)`);

    // Broadcast round update via WebSocket
    if (global.wsBroadcast) {
      global.wsBroadcast(`round:${roundId}`, {
        type: 'round_updated',
        data: {
          round_id: roundId,
          status: 'active',
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          duration_seconds: round.duration_seconds,
        },
      });
      console.log(`📢 [WebSocket] Broadcast round start to round:${roundId}`);
    }

    return NextResponse.json({
      success: true,
      data: {
        round_id: roundId,
        round_number: round.round_number,
        status: 'active',
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        duration_seconds: round.duration_seconds,
        message: `Bulk round ${round.round_number} has been started. Teams can now place bids.`,
      },
    });

  } catch (error: any) {
    console.error('❌ Error starting bulk round:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
