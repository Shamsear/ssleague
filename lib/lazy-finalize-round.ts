import { neon } from '@neondatabase/serverless';
import { finalizeRound, applyFinalizationResults } from '@/lib/finalize-round';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * Check if a round has expired and auto-finalize it
 * This is called whenever a round is accessed (lazy finalization)
 * 
 * @param roundId - The round ID to check
 * @returns Object with finalized status and any errors
 */
export async function checkAndFinalizeExpiredRound(roundId: string): Promise<{
  finalized: boolean;
  alreadyFinalized: boolean;
  error?: string;
}> {
  try {
    // Get round details
    const roundResult = await sql`
      SELECT 
        id,
        status,
        end_time,
        position
      FROM rounds
      WHERE id = ${roundId}
    `;

    if (roundResult.length === 0) {
      return { finalized: false, alreadyFinalized: false, error: 'Round not found' };
    }

    const round = roundResult[0];

    // If round is not active, don't attempt finalization
    if (round.status !== 'active') {
      return { 
        finalized: false, 
        alreadyFinalized: round.status === 'completed' || round.status === 'finalizing'
      };
    }

    // Check if round has expired
    const now = new Date();
    const endTime = new Date(round.end_time);

    if (now <= endTime) {
      // Round hasn't expired yet
      return { finalized: false, alreadyFinalized: false };
    }

    // Round has expired and is still active - auto-finalize it
    console.log(`🔄 Auto-finalizing expired round ${roundId} (${round.position})`);

    const finalizationResult = await finalizeRound(roundId);

    if (!finalizationResult.success) {
      if (finalizationResult.tieDetected) {
        // Tie detected - mark round as 'finalizing' (tiebreaker needed)
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
          error: 'Tiebreaker required'
        };
      }

      console.error(`❌ Failed to finalize round ${roundId}:`, finalizationResult.error);
      return { 
        finalized: false, 
        alreadyFinalized: false, 
        error: finalizationResult.error 
      };
    }

    // Apply finalization results
    const applyResult = await applyFinalizationResults(
      roundId,
      finalizationResult.allocations
    );

    if (!applyResult.success) {
      console.error(`❌ Failed to apply finalization for round ${roundId}:`, applyResult.error);
      return { 
        finalized: false, 
        alreadyFinalized: false, 
        error: applyResult.error 
      };
    }

    console.log(`✅ Successfully auto-finalized round ${roundId}`);
    return { finalized: true, alreadyFinalized: false };

  } catch (error) {
    console.error('Error in checkAndFinalizeExpiredRound:', error);
    return { 
      finalized: false, 
      alreadyFinalized: false, 
      error: 'Internal error during finalization' 
    };
  }
}
