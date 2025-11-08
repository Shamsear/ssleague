import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '@/lib/auth-helper';
import { broadcastRoundUpdate } from '@/lib/realtime/broadcast';
import { sendNotificationToSeason } from '@/lib/notifications/send-notification';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

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

    // Broadcast round update via Firebase Realtime DB
    // Need to get season_id for the round
    const seasonResult = await sql`SELECT season_id FROM rounds WHERE id = ${roundId}`;
    const seasonId = seasonResult[0]?.season_id;
    
    if (seasonId) {
      await broadcastRoundUpdate(seasonId, roundId, {
        status: 'active',
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        duration_seconds: round.duration_seconds,
      });

      // Send FCM notification
      try {
        const durationMinutes = Math.round(round.duration_seconds / 60);
        const durationText = durationMinutes >= 60 
          ? `${Math.round(durationMinutes / 60)} hour${Math.round(durationMinutes / 60) !== 1 ? 's' : ''}` 
          : `${durationMinutes} minute${durationMinutes !== 1 ? 's' : ''}`;
        await sendNotificationToSeason(
          {
            title: '⚡ Bulk Auction Round Started!',
            body: `Round ${round.round_number} is now active. Duration: ${durationText}. Bid on multiple players!`,
            url: `/dashboard/committee/bulk-rounds/${roundId}`,
            icon: '/logo.png',
            data: {
              type: 'bulk_round_started',
              roundId,
              roundNumber: round.round_number.toString(),
              endTime: endTime.toISOString()
            }
          },
          seasonId
        );
      } catch (notifError) {
        console.error('Failed to send bulk round start notification:', notifError);
      }
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
