import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '@/lib/auth-helper';
import { finalizeRound } from '@/lib/finalize-round';
import { logPreviewFinalization } from '@/lib/audit-logger';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * POST /api/admin/rounds/[id]/preview-finalization
 * Preview finalization results and store in pending_allocations table
 * Does NOT apply changes - just calculates and stores for review
 * 
 * WORKFLOW:
 * 1. Verify round has finalization_mode = 'manual'
 * 2. Verify round status is 'expired_pending_finalization' or 'active' (but expired)
 * 3. Call finalizeRound() to calculate winners (same logic as immediate finalization)
 * 4. If tie detected, create tiebreaker and return error (cannot preview until resolved)
 * 5. Store calculated allocations in pending_allocations table
 * 6. Update round status to 'pending_finalization'
 * 7. Return allocations and summary statistics to committee
 * 
 * IMPORTANT: This endpoint does NOT modify:
 * - Team budgets
 * - Player allocations
 * - Contracts
 * - Transaction logs
 * 
 * Those changes only happen when committee clicks "Finalize for Real"
 * (which calls the apply-pending-allocations endpoint)
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
        position,
        status,
        finalization_mode,
        season_id,
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

    // Validate finalization mode
    if (round.finalization_mode !== 'manual') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Preview finalization is only available for rounds with manual finalization mode' 
        },
        { status: 400 }
      );
    }

    // Validate round status - must be expired or active (but expired)
    const now = new Date();
    const endTime = new Date(round.end_time);
    const isExpired = now > endTime;

    if (round.status === 'completed') {
      return NextResponse.json(
        { success: false, error: 'Round is already finalized' },
        { status: 400 }
      );
    }

    if (round.status === 'pending_finalization') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Round already has pending allocations. Cancel them first to re-preview.' 
        },
        { status: 400 }
      );
    }

    if (!isExpired && round.status === 'active') {
      return NextResponse.json(
        { success: false, error: 'Round has not expired yet' },
        { status: 400 }
      );
    }

    // Call existing finalizeRound() function to calculate winners
    // This function analyzes all bids and determines which teams win which players
    // It handles both regular phase (highest bidder wins) and incomplete phase (random allocation)
    // IMPORTANT: This does NOT apply any changes - it only calculates the results
    console.log(`🔍 Calculating finalization preview for round ${roundId}`);
    const finalizationResult = await finalizeRound(roundId);

    if (!finalizationResult.success) {
      // Handle tiebreaker detection
      // If multiple teams bid the same amount for a player, a tiebreaker is required
      // We cannot proceed with preview until the tiebreaker is resolved
      if (finalizationResult.tieDetected) {
        console.log(`⚠️ Tie detected in round ${roundId}, tiebreaker created`);
        
        // Update round status to tiebreaker_pending
        // Status transition: expired_pending_finalization -> tiebreaker_pending
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
          tiedBids: finalizationResult.tiedBids?.map(bid => ({
            team_name: bid.team_name,
            player_name: bid.player_name,
            amount: bid.amount,
          })),
          message: 'Tie detected. Tiebreaker must be resolved before finalization.',
        });
      }

      return NextResponse.json(
        { success: false, error: finalizationResult.error },
        { status: 400 }
      );
    }

    // Store allocations in pending_allocations table
    // This is the key difference from immediate finalization - we store results for review
    // instead of applying them immediately
    console.log(`💾 Storing ${finalizationResult.allocations.length} pending allocations`);
    
    // Clear any existing pending allocations for this round (in case of re-preview)
    // This allows committee to cancel and re-preview if they want fresh calculations
    await sql`DELETE FROM pending_allocations WHERE round_id = ${roundId}`;

    // Insert new pending allocations
    // Each allocation represents one team winning one player
    // The 'phase' field indicates if this was a regular bid or incomplete/random allocation
    for (const allocation of finalizationResult.allocations) {
      await sql`
        INSERT INTO pending_allocations (
          round_id,
          team_id,
          team_name,
          player_id,
          player_name,
          amount,
          bid_id,
          phase,
          created_at
        ) VALUES (
          ${roundId},
          ${allocation.team_id},
          ${allocation.team_name},
          ${allocation.player_id},
          ${allocation.player_name},
          ${allocation.amount},
          ${allocation.bid_id},
          ${allocation.phase},
          NOW()
        )
      `;
    }

    // Update round status to 'pending_finalization'
    // Status transition: expired_pending_finalization -> pending_finalization
    // This indicates that results have been calculated and are awaiting committee approval
    await sql`
      UPDATE rounds
      SET status = 'pending_finalization',
          updated_at = NOW()
      WHERE id = ${roundId}
    `;

    console.log(`✅ Preview finalization complete for round ${roundId}`);

    // Log audit action
    await logPreviewFinalization(
      auth.userId || 'unknown',
      roundId,
      round.season_id,
      finalizationResult.allocations.length,
      auth.email
    );

    // Calculate summary statistics for committee review
    // These help the committee quickly understand the finalization results
    const totalSpent = finalizationResult.allocations.reduce((sum, a) => sum + a.amount, 0);
    const averageBid = finalizationResult.allocations.length > 0 
      ? Math.round(totalSpent / finalizationResult.allocations.length)
      : 0;
    
    const regularAllocations = finalizationResult.allocations.filter(a => a.phase === 'regular');
    const incompleteAllocations = finalizationResult.allocations.filter(a => a.phase === 'incomplete');
    
    const uniqueTeams = new Set(finalizationResult.allocations.map(a => a.team_id));
    
    // Get total teams in season to calculate skipped teams
    // Skipped teams are those that didn't win any player (either didn't bid or lost all bids)
    const allTeamsResult = await sql`
      SELECT COUNT(*) as count FROM teams WHERE season_id = ${round.season_id}
    `;
    const totalTeams = allTeamsResult[0]?.count || 0;
    const teamsSkipped = totalTeams - uniqueTeams.size;

    // Generate warnings to alert committee of potential issues
    // Incomplete allocations: Teams that didn't submit bids but got random players
    // Skipped teams: Teams that didn't win anything (may indicate they didn't participate)
    const warnings: string[] = [];
    if (incompleteAllocations.length > 0) {
      warnings.push(`${incompleteAllocations.length} team(s) received incomplete/random allocations`);
    }
    if (teamsSkipped > 0) {
      warnings.push(`${teamsSkipped} team(s) did not receive any allocation`);
    }

    // Return allocations and summary
    return NextResponse.json({
      success: true,
      data: {
        allocations: finalizationResult.allocations.map(a => ({
          team_id: a.team_id,
          team_name: a.team_name,
          player_id: a.player_id,
          player_name: a.player_name,
          amount: a.amount,
          phase: a.phase,
        })),
        summary: {
          total_players: finalizationResult.allocations.length,
          total_spent: totalSpent,
          average_bid: averageBid,
          teams_allocated: uniqueTeams.size,
          teams_skipped: teamsSkipped,
        },
        warnings: warnings.length > 0 ? warnings : undefined,
      },
      message: 'Preview finalization complete. Review the allocations and click "Finalize for Real" to apply.',
    });
  } catch (error) {
    console.error('Error in preview finalization:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
