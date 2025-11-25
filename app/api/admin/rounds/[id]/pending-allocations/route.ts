import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '@/lib/auth-helper';
import { logCancelPendingAllocations } from '@/lib/audit-logger';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * GET /api/admin/rounds/[id]/pending-allocations
 * Retrieve pending allocations for a round
 * Returns allocations stored in pending_allocations table with summary statistics
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify committee_admin authorization
    const auth = await verifyAuth(['admin', 'committee_admin'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: roundId } = await params;

    // Verify round exists
    const roundResult = await sql`
      SELECT id, season_id, status
      FROM rounds
      WHERE id = ${roundId}
    `;

    if (roundResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Round not found' },
        { status: 404 }
      );
    }

    // Fetch pending allocations from database
    // These were stored during the preview step and represent calculated winners
    // Ordered by amount DESC to show highest bids first (most important allocations)
    const pendingAllocations = await sql`
      SELECT 
        id,
        round_id,
        team_id,
        team_name,
        player_id,
        player_name,
        amount,
        bid_id,
        phase,
        created_at
      FROM pending_allocations
      WHERE round_id = ${roundId}
      ORDER BY amount DESC
    `;

    // If no pending allocations, return empty result
    // This can happen if:
    // 1. Preview hasn't been run yet
    // 2. Pending allocations were canceled
    // 3. Allocations were already applied (finalized)
    if (pendingAllocations.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          allocations: [],
          summary: {
            total_players: 0,
            total_spent: 0,
            average_bid: 0,
          },
        },
        message: 'No pending allocations found for this round',
      });
    }

    // Calculate summary statistics for committee review
    // These help the committee understand the financial impact of finalization
    const totalSpent = pendingAllocations.reduce((sum, a) => sum + a.amount, 0);
    const averageBid = Math.round(totalSpent / pendingAllocations.length);

    // Return formatted response
    return NextResponse.json({
      success: true,
      data: {
        allocations: pendingAllocations.map(a => ({
          id: a.id,
          team_id: a.team_id,
          team_name: a.team_name,
          player_id: a.player_id,
          player_name: a.player_name,
          amount: a.amount,
          phase: a.phase,
          created_at: a.created_at,
        })),
        summary: {
          total_players: pendingAllocations.length,
          total_spent: totalSpent,
          average_bid: averageBid,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching pending allocations:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/rounds/[id]/pending-allocations
 * Cancel pending allocations for a round
 * 
 * WORKFLOW:
 * 1. Verify pending allocations exist
 * 2. Delete all pending allocations for the round
 * 3. Update round status back to 'expired_pending_finalization'
 * 4. Log audit action
 * 
 * USE CASES:
 * - Committee wants to re-run preview with fresh calculations
 * - Committee found an issue with the preview results
 * - Bids were modified and preview needs to be recalculated
 * 
 * AFTER CANCELLATION:
 * Committee can:
 * - Run "Preview Results" again to get new calculations
 * - Click "Finalize Immediately" to skip preview
 * 
 * NOTE: This is a safe operation - no team budgets or allocations are affected
 * since pending allocations were never applied
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify committee_admin authorization
    const auth = await verifyAuth(['admin', 'committee_admin'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: roundId } = await params;

    // Verify round exists and get current status
    const roundResult = await sql`
      SELECT id, season_id, status, finalization_mode
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

    // Check if there are pending allocations to cancel
    const pendingCount = await sql`
      SELECT COUNT(*) as count
      FROM pending_allocations
      WHERE round_id = ${roundId}
    `;

    const allocationsCount = pendingCount[0]?.count || 0;

    if (allocationsCount === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No pending allocations found for this round',
          message: 'There are no pending allocations to cancel'
        },
        { status: 400 }
      );
    }

    // Log action for audit (console logging as per project pattern)
    // This is important for tracking committee actions and debugging issues
    console.log(`🗑️ Canceling ${allocationsCount} pending allocation(s) for round ${roundId}`);
    console.log(`📋 Audit: User ${auth.userId || 'unknown'} canceling pending allocations for round ${roundId} at ${new Date().toISOString()}`);

    // Delete all pending allocations for this round
    // This is a destructive operation - the committee will need to re-run preview to see results again
    await sql`
      DELETE FROM pending_allocations
      WHERE round_id = ${roundId}
    `;

    console.log(`✅ Deleted ${allocationsCount} pending allocation(s)`);

    // Update round status back to 'expired_pending_finalization'
    // Status transition: pending_finalization -> expired_pending_finalization
    // This resets the round to the state before preview was run
    // Committee can now:
    // 1. Run preview again (maybe bids changed, or they want fresh calculations)
    // 2. Finalize immediately (skip preview)
    await sql`
      UPDATE rounds
      SET status = 'expired_pending_finalization',
          updated_at = NOW()
      WHERE id = ${roundId}
    `;

    console.log(`✅ Round status updated to 'expired_pending_finalization'`);
    console.log(`📋 Audit: Pending allocations canceled successfully for round ${roundId}`);

    // Log audit action
    await logCancelPendingAllocations(
      auth.userId || 'unknown',
      roundId,
      round.season_id,
      allocationsCount,
      auth.email
    );

    return NextResponse.json({
      success: true,
      message: `Successfully canceled ${allocationsCount} pending allocation(s). You can now preview finalization again or finalize immediately.`,
      data: {
        allocations_canceled: allocationsCount,
        round_status: 'expired_pending_finalization',
      },
    });
  } catch (error) {
    console.error('Error canceling pending allocations:', error);
    console.error('📋 Audit: Failed to cancel pending allocations:', error instanceof Error ? error.message : 'Unknown error');
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error while canceling pending allocations',
        details: 'An unexpected error occurred. Please try again or contact support.'
      },
      { status: 500 }
    );
  }
}
