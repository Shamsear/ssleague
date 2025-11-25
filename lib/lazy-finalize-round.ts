import { neon } from '@neondatabase/serverless';
import { finalizeRound, applyFinalizationResults } from '@/lib/finalize-round';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * Check if a round has expired and auto-finalize it
 * This is called whenever a round is accessed (lazy finalization)
 * 
 * ROUND STATUS TRANSITIONS:
 * 
 * AUTO-FINALIZE MODE (finalization_mode = 'auto'):
 *   active -> finalizing -> completed (or tiebreaker_pending if tie detected)
 * 
 * MANUAL FINALIZATION MODE (finalization_mode = 'manual'):
 *   active -> expired_pending_finalization (when timer expires)
 *   expired_pending_finalization -> pending_finalization (when preview is run)
 *   expired_pending_finalization -> completed (when "Finalize Immediately" is clicked)
 *   pending_finalization -> completed (when "Finalize for Real" is clicked)
 *   pending_finalization -> expired_pending_finalization (when "Cancel Pending" is clicked)
 *   expired_pending_finalization -> tiebreaker_pending (if tie detected during preview)
 * 
 * KEY DIFFERENCES:
 * - Auto mode: Immediate finalization when timer expires (legacy behavior)
 * - Manual mode: Two-step process with preview and approval
 * 
 * @param roundId - The round ID to check
 * @returns Object with finalized status and any errors
 */
export async function checkAndFinalizeExpiredRound(roundId: string): Promise<{
  finalized: boolean;
  alreadyFinalized: boolean;
  pendingManualFinalization: boolean;
  error?: string;
}> {
  try {
    // Get round details including finalization_mode
    const roundResult = await sql`
      SELECT 
        id,
        status,
        end_time,
        position,
        finalization_mode
      FROM rounds
      WHERE id = ${roundId}
    `;

    if (roundResult.length === 0) {
      return { finalized: false, alreadyFinalized: false, pendingManualFinalization: false, error: 'Round not found' };
    }

    const round = roundResult[0];

    // If round is not active, don't attempt finalization
    // Possible statuses and their meanings:
    // - 'active': Round is ongoing, may need finalization if expired
    // - 'completed': Round already finalized, results applied
    // - 'finalizing': Round is currently being finalized (lock acquired)
    // - 'expired_pending_finalization': Round expired with manual mode, awaiting committee action
    // - 'pending_finalization': Committee previewed results, awaiting approval
    // - 'tiebreaker_pending': Tie detected, tiebreaker round created
    if (round.status !== 'active') {
      return { 
        finalized: false, 
        alreadyFinalized: round.status === 'completed' || round.status === 'finalizing',
        pendingManualFinalization: round.status === 'expired_pending_finalization' || round.status === 'pending_finalization'
      };
    }

    // Check if round has expired by comparing current time with end_time
    const now = new Date();
    const endTime = new Date(round.end_time);

    if (now <= endTime) {
      // Round hasn't expired yet - no action needed
      return { finalized: false, alreadyFinalized: false, pendingManualFinalization: false };
    }

    // Check finalization mode - this determines the finalization workflow
    // Mode 'manual': Committee must preview and approve results before they're applied
    // Mode 'auto': Results are calculated and applied immediately (current/legacy behavior)
    if (round.finalization_mode === 'manual') {
      console.log(`⏸️ Round ${roundId} expired but has manual finalization mode - updating status to expired_pending_finalization`);
      
      // Update status to indicate manual finalization is needed
      // Status transition: active -> expired_pending_finalization
      // This status tells the committee UI to show "Preview Results" and "Finalize Immediately" buttons
      await sql`
        UPDATE rounds 
        SET status = 'expired_pending_finalization', updated_at = NOW()
        WHERE id = ${roundId} AND status = 'active'
      `;
      
      return { 
        finalized: false, 
        alreadyFinalized: false,
        pendingManualFinalization: true
      };
    }

    // Round has expired and is still active - auto-finalize it
    // This is the legacy/default behavior for rounds with finalization_mode = 'auto'
    console.log(`🔄 Auto-finalizing expired round ${roundId} (${round.position})`);
    
    // Try to acquire lock by updating status to 'finalizing'
    // This prevents race conditions where multiple concurrent requests try to finalize the same round
    // Only the first request will successfully update the status from 'active' to 'finalizing'
    const lockResult = await sql`
      UPDATE rounds 
      SET status = 'finalizing', updated_at = NOW()
      WHERE id = ${roundId} AND status = 'active'
      RETURNING id
    `;
    
    // If no rows updated, another request already grabbed this round
    if (lockResult.length === 0) {
      console.log(`⚠️ Round ${roundId} already being finalized by another request - skipping`);
      return { finalized: false, alreadyFinalized: true, pendingManualFinalization: false };
    }
    
    console.log(`🔒 Acquired finalization lock for round ${roundId}`);

    // Calculate winners using the finalization algorithm
    // This analyzes all bids and determines allocations
    const finalizationResult = await finalizeRound(roundId);

    if (!finalizationResult.success) {
      if (finalizationResult.tieDetected) {
        // Tie detected - mark round as 'finalizing' (tiebreaker needed)
        // Status remains 'finalizing' until tiebreaker is resolved
        // The tiebreaker system will handle creating the tiebreaker round
        await sql`
          UPDATE rounds
          SET status = 'finalizing',
              updated_at = NOW()
          WHERE id = ${roundId}
        `;

        console.log(`⚠️ Tie detected in round ${roundId}, created tiebreaker`);
        return { 
          finalized: true, 
          alreadyFinalized: false,
          pendingManualFinalization: false,
          error: 'Tiebreaker required'
        };
      }

      console.error(`❌ Failed to finalize round ${roundId}:`, finalizationResult.error);
      return { 
        finalized: false, 
        alreadyFinalized: false,
        pendingManualFinalization: false,
        error: finalizationResult.error 
      };
    }

    // Apply finalization results immediately (no preview step for auto mode)
    // This function handles:
    // 1. Deducting budgets from teams
    // 2. Allocating players to teams (creating contracts)
    // 3. Logging transactions
    // 4. Updating round status to 'completed'
    const applyResult = await applyFinalizationResults(
      roundId,
      finalizationResult.allocations
    );

    if (!applyResult.success) {
      console.error(`❌ Failed to apply finalization for round ${roundId}:`, applyResult.error);
      return { 
        finalized: false, 
        alreadyFinalized: false,
        pendingManualFinalization: false,
        error: applyResult.error 
      };
    }

    console.log(`✅ Successfully auto-finalized round ${roundId}`);
    return { finalized: true, alreadyFinalized: false, pendingManualFinalization: false };

  } catch (error) {
    console.error('Error in checkAndFinalizeExpiredRound:', error);
    return { 
      finalized: false, 
      alreadyFinalized: false,
      pendingManualFinalization: false,
      error: 'Internal error during finalization' 
    };
  }
}
