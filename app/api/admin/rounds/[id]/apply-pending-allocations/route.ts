import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '@/lib/auth-helper';
import { applyFinalizationResults, AllocationResult } from '@/lib/finalize-round';
import { broadcastRoundUpdate } from '@/lib/realtime/broadcast';
import { adminDb } from '@/lib/firebase/admin';
import { logApplyPendingAllocations } from '@/lib/audit-logger';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * POST /api/admin/rounds/[id]/apply-pending-allocations
 * Apply pending allocations (makes them official)
 * 
 * WORKFLOW:
 * 1. Verify round status is 'pending_finalization'
 * 2. Fetch pending allocations from database
 * 3. Validate team budgets are sufficient (critical - budgets may have changed since preview)
 * 4. Transform pending allocations to AllocationResult[] format
 * 5. Call applyFinalizationResults() to:
 *    - Deduct budgets from teams
 *    - Allocate players to teams (create contracts)
 *    - Log transactions
 *    - Update round status to 'completed'
 * 6. Delete pending allocations (no longer needed)
 * 7. Broadcast real-time update to teams via WebSocket
 * 8. Log audit action
 * 
 * ERROR HANDLING:
 * - Budget validation: If any team has insufficient funds, entire operation fails (atomic)
 * - Database errors: All changes are rolled back by applyFinalizationResults()
 * - Broadcast failures: Non-critical, finalization still succeeds
 * 
 * IMPORTANT: This is the point where changes become official and visible to teams
 */
export async function POST(
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

    // Get round details
    const roundResult = await sql`
      SELECT 
        id,
        season_id,
        status,
        finalization_mode
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

    // Validate round status
    if (round.status === 'completed') {
      return NextResponse.json(
        { success: false, error: 'Round is already finalized' },
        { status: 400 }
      );
    }

    if (round.status !== 'pending_finalization') {
      return NextResponse.json(
        { 
          success: false, 
          error: `Cannot apply pending allocations. Round status is '${round.status}'. Expected 'pending_finalization'.` 
        },
        { status: 400 }
      );
    }

    // Fetch pending allocations from database
    // These were stored during the preview step and represent the calculated winners
    console.log(`📋 Fetching pending allocations for round ${roundId}`);
    const pendingAllocations = await sql`
      SELECT 
        team_id,
        team_name,
        player_id,
        player_name,
        amount,
        bid_id,
        phase
      FROM pending_allocations
      WHERE round_id = ${roundId}
      ORDER BY amount DESC
    `;

    if (pendingAllocations.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No pending allocations found for this round' },
        { status: 400 }
      );
    }

    console.log(`💰 Validating budgets for ${pendingAllocations.length} allocations`);

    // Validate team budgets are sufficient before applying changes
    // This is critical because budgets may have changed since preview was created
    // (e.g., team spent money in another round, admin adjusted budget, etc.)
    const budgetValidationErrors: string[] = [];
    
    for (const allocation of pendingAllocations) {
      try {
        // Construct team_season document ID (format: teamId_seasonId)
        const tsId = `${allocation.team_id}_${round.season_id}`;
        const tsDoc = await adminDb.collection('team_seasons').doc(tsId).get();
        
        if (!tsDoc.exists) {
          budgetValidationErrors.push(
            `Team ${allocation.team_name} (${allocation.team_id}) not found in season`
          );
          continue;
        }

        const tsd = tsDoc.data();
        // Check currency system to determine which budget field to use
        // Dual currency: football_budget for football players, cricket_budget for cricket
        // Single currency: budget for all players
        const curr = tsd?.currency_system || 'single';
        const teamBalance = curr === 'dual' 
          ? (tsd?.football_budget || 0) 
          : (tsd?.budget || 0);

        // Verify team has sufficient funds for this allocation
        if (teamBalance < allocation.amount) {
          const shortfall = allocation.amount - teamBalance;
          budgetValidationErrors.push(
            `Team ${allocation.team_name} has insufficient funds. ` +
            `Required: £${allocation.amount}, Available: £${teamBalance}, Shortfall: £${shortfall}`
          );
        }
      } catch (error) {
        console.error(`Error validating budget for team ${allocation.team_id}:`, error);
        budgetValidationErrors.push(
          `Failed to validate budget for team ${allocation.team_name}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    // If any budget validation errors, return them and DO NOT proceed
    // This is an all-or-nothing operation - we don't want partial allocations
    if (budgetValidationErrors.length > 0) {
      console.error('❌ Budget validation failed:', budgetValidationErrors);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Budget validation failed',
          details: {
            type: 'budget',
            errors: budgetValidationErrors,
          }
        },
        { status: 400 }
      );
    }

    console.log('✅ Budget validation passed');

    // Transform pending allocations to AllocationResult[] format
    // This format is expected by applyFinalizationResults() function
    const allocations: AllocationResult[] = pendingAllocations.map(pa => ({
      team_id: pa.team_id,
      team_name: pa.team_name,
      player_id: pa.player_id,
      player_name: pa.player_name,
      amount: pa.amount,
      bid_id: pa.bid_id,
      phase: pa.phase as 'regular' | 'incomplete',
    }));

    console.log(`🚀 Applying ${allocations.length} pending allocations`);

    // Call existing applyFinalizationResults() function
    // This function handles:
    // 1. Deducting budgets from teams
    // 2. Allocating players to teams (creating contracts)
    // 3. Logging transactions
    // 4. Updating round status to 'completed'
    // All operations are wrapped in a transaction for atomicity
    const applyResult = await applyFinalizationResults(roundId, allocations);

    if (!applyResult.success) {
      console.error('❌ Failed to apply finalization results:', applyResult.error);
      
      // Log audit action for failure
      await logApplyPendingAllocations(
        auth.userId || 'unknown',
        roundId,
        round.season_id,
        allocations.length,
        false,
        applyResult.error || 'Failed to apply pending allocations',
        auth.email
      );
      
      return NextResponse.json(
        { 
          success: false, 
          error: applyResult.error || 'Failed to apply pending allocations',
          details: {
            type: 'database',
            message: 'Finalization results could not be applied. No changes were made.',
          }
        },
        { status: 500 }
      );
    }

    console.log('✅ Finalization results applied successfully');

    // Delete pending allocations on success
    // These are no longer needed since the allocations have been applied
    // Keeping them would cause confusion if someone tries to view pending results
    console.log('🗑️ Deleting pending allocations');
    await sql`DELETE FROM pending_allocations WHERE round_id = ${roundId}`;

    console.log('✅ Pending allocations deleted');

    // Note: Round status is already updated to 'completed' by applyFinalizationResults()
    // But we'll verify it here for safety in case that function changes in the future
    const statusCheck = await sql`SELECT status FROM rounds WHERE id = ${roundId}`;
    if (statusCheck[0]?.status !== 'completed') {
      console.warn('⚠️ Round status not set to completed, updating now');
      await sql`UPDATE rounds SET status = 'completed', updated_at = NOW() WHERE id = ${roundId}`;
    }

    // Broadcast real-time update to teams via WebSocket
    // This notifies team dashboards to refresh and show the new results
    // Teams will see their new players and updated budgets immediately
    console.log('📡 Broadcasting round finalization to teams');
    try {
      await broadcastRoundUpdate(round.season_id, roundId, {
        status: 'completed',
        finalized: true,
        allocations_count: allocations.length,
        round_id: roundId,
        season_id: round.season_id,
        event_type: 'finalization_complete',
      });
      console.log('✅ Real-time update broadcasted');
    } catch (broadcastError) {
      console.error('⚠️ Failed to broadcast update (non-critical):', broadcastError);
      // Don't fail the request if broadcast fails - the finalization was successful
      // Teams will see results on next page refresh
    }

    console.log(`🎉 Round ${roundId} finalization complete!`);

    // Log audit action for success
    await logApplyPendingAllocations(
      auth.userId || 'unknown',
      roundId,
      round.season_id,
      allocations.length,
      true,
      undefined,
      auth.email
    );

    return NextResponse.json({
      success: true,
      message: `Successfully finalized round. ${allocations.length} player(s) allocated.`,
      data: {
        allocations_count: allocations.length,
        round_status: 'completed',
      },
    });
  } catch (error) {
    console.error('Error applying pending allocations:', error);
    
    // Log the error for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Full error details:', errorMessage);

    // Try to log audit action for unexpected failure
    try {
      const auth = await verifyAuth(['admin', 'committee_admin'], request);
      const { id: roundId } = await params;
      const roundResult = await sql`SELECT season_id FROM rounds WHERE id = ${roundId}`;
      
      if (auth.authenticated && roundResult.length > 0) {
        await logApplyPendingAllocations(
          auth.userId || 'unknown',
          roundId,
          roundResult[0].season_id,
          0,
          false,
          errorMessage,
          auth.email
        );
      }
    } catch (auditError) {
      console.error('Failed to log audit action for error:', auditError);
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error while applying pending allocations',
        details: {
          type: 'database',
          message: 'An unexpected error occurred. Please try again or contact support.',
        }
      },
      { status: 500 }
    );
  }
}
