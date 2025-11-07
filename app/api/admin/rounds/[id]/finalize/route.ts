import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '@/lib/auth-helper';
import { finalizeRound, applyFinalizationResults } from '@/lib/finalize-round';
import { sendNotificationToSeason, sendNotification } from '@/lib/notifications/send-notification';
import { broadcastRoundUpdate } from '@/lib/realtime/broadcast';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * POST /api/admin/rounds/[id]/finalize
 * Manually finalize a round (admin only)
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

    // Get round details
    const roundResult = await sql`
      SELECT 
        id,
        position,
        status,
        end_time
      FROM rounds
      WHERE id = ${roundId}
    `;

    if (roundResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Round not found' },
        { status: 404 }
      );
    }

    const round = roundResult[0];

    // Check if round is active or tiebreaker_pending (allow finalization of stuck rounds)
    if (round.status !== 'active' && round.status !== 'tiebreaker_pending') {
      return NextResponse.json(
        { success: false, error: 'Round must be active or tiebreaker_pending to finalize' },
        { status: 400 }
      );
    }

    // Run finalization algorithm
    const finalizationResult = await finalizeRound(roundId);

    if (!finalizationResult.success) {
      if (finalizationResult.tieDetected) {
        // Tie detected - tiebreaker created, mark round as 'tiebreaker_pending'
        await sql`
          UPDATE rounds
          SET status = 'tiebreaker_pending',
              updated_at = NOW()
          WHERE id = ${roundId}
        `;

        return NextResponse.json({
          success: false,
          tieDetected: true,
          tiebreakerId: finalizationResult.tiebreakerId,
          tiedBids: finalizationResult.tiedBids,
          message: 'Tie detected. Tiebreaker created. Teams must submit new bids.',
        });
      }

      return NextResponse.json(
        { success: false, error: finalizationResult.error },
        { status: 400 }
      );
    }

    // Apply finalization results to database
    const applyResult = await applyFinalizationResults(
      roundId,
      finalizationResult.allocations
    );

    if (!applyResult.success) {
      return NextResponse.json(
        { success: false, error: applyResult.error },
        { status: 500 }
      );
    }

    // Get season for notifications
    const seasonResult = await sql`
      SELECT season_id FROM rounds WHERE id = ${roundId}
    `;
    const seasonId = seasonResult[0]?.season_id;
    
    // Send general round finalized notification to all teams
    if (seasonId) {
      try {
        console.log(`📣 Sending round finalized notification for season ${seasonId}, round ${roundId}`);
        const notifResult = await sendNotificationToSeason(
          {
            title: '🏁 Round Finalized!',
            body: `${round.position} bidding round has been completed. ${finalizationResult.allocations.length} players allocated. Check results now!`,
            url: `/dashboard/team`,
            icon: '/logo.png',
            data: {
              type: 'round_finalized',
              roundId: roundId,
              position: round.position,
              allocationsCount: finalizationResult.allocations.length
            }
          },
          seasonId
        );
        console.log(`✅ Round finalized notification result:`, notifResult);
      } catch (notifError) {
        console.error('Failed to send round finalized notification:', notifError);
      }
    }
    
    // Broadcast round finalized via Firebase Realtime DB
    if (seasonId) {
      await broadcastRoundUpdate(seasonId, roundId, {
        type: 'round_finalized',
        status: 'completed',
        round_id: roundId,
        allocations_count: finalizationResult.allocations.length,
      });
    }

    // Send notifications to winners
    try {
      // Notify each winning team
      for (const allocation of finalizationResult.allocations) {
        try {
          await sendNotification(
            {
              title: '🎉 Player Won!',
              body: `Congratulations! You won ${allocation.player_name} for £${allocation.amount.toLocaleString()}`,
              url: `/dashboard/team`,
              icon: '/logo.png',
              data: {
                type: 'player_won',
                roundId,
                playerId: allocation.player_id,
                playerName: allocation.player_name,
                amount: allocation.amount.toString(),
                phase: allocation.phase
              }
            },
            { teamId: allocation.team_id }
          );
        } catch (err) {
          console.error(`Failed to send notification to team ${allocation.team_id}:`, err);
        }
      }

      console.log(`✅ Sent ${finalizationResult.allocations.length} winner notifications`);
    } catch (notifError) {
      console.error('Error sending winner notifications:', notifError);
      // Don't fail the entire operation if notifications fail
    }

    // Return success with allocations
    return NextResponse.json({
      success: true,
      message: 'Round finalized successfully',
      allocations: finalizationResult.allocations.map(alloc => ({
        team_name: alloc.team_name,
        player_name: alloc.player_name,
        amount: alloc.amount,
        phase: alloc.phase,
      })),
    });
  } catch (error) {
    console.error('Error finalizing round:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
