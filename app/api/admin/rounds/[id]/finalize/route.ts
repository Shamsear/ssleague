import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '@/lib/auth-helper';
import { finalizeRound, applyFinalizationResults } from '@/lib/finalize-round';
import { sendNotificationToSeason, sendNotification } from '@/lib/notifications/send-notification';

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

    // Send notifications to winners and losers
    try {
      // Get round and season details for notifications
      const roundDetails = await sql`
        SELECT r.*, s.id as season_id, s.name as season_name
        FROM rounds r
        JOIN seasons s ON r.season_id = s.id
        WHERE r.id = ${roundId}
        LIMIT 1
      `;

      if (roundDetails.length > 0) {
        const roundInfo = roundDetails[0];

        // Notify each team about their result
        for (const allocation of finalizationResult.allocations) {
          const teamId = allocation.team_id;
          const playerName = allocation.player_name;
          const amount = allocation.amount;
          const won = allocation.won;

          if (won) {
            // Winner notification
            await sendNotification(
              {
                title: '🎉 Player Won!',
                body: `Congratulations! You won ${playerName} for $${amount.toLocaleString()}`,
                url: `/dashboard/team/round/${roundId}`,
                icon: '/logo.png',
                data: {
                  type: 'round_result',
                  roundId,
                  playerId: allocation.player_id || '',
                  result: 'won'
                }
              },
              { teamId }
            );
          } else {
            // Loser notification
            await sendNotification(
              {
                title: '❌ Bid Lost',
                body: `You lost the bid for ${playerName}. Better luck next time!`,
                url: `/dashboard/team/round/${roundId}`,
                icon: '/logo.png',
                data: {
                  type: 'round_result',
                  roundId,
                  playerId: allocation.player_id || '',
                  result: 'lost'
                }
              },
              { teamId }
            );
          }
        }

        console.log(`✅ Sent ${finalizationResult.allocations.length} round result notifications`);
      }
    } catch (notifError) {
      console.error('Error sending round finalization notifications:', notifError);
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
