import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { finalizeRound, applyFinalizationResults } from '@/lib/finalize-round';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * GET /api/cron/finalize-rounds
 * Automatically finalize rounds that have expired
 * 
 * This endpoint should be called by a cron job or scheduled task
 * For production, you can use:
 * - Vercel Cron Jobs
 * - External services like EasyCron, cron-job.org
 * - GitHub Actions scheduled workflow
 * - Windows Task Scheduler (for local development)
 * 
 * Security: In production, protect this endpoint with:
 * - Authorization header with secret token
 * - IP whitelist
 * - Vercel Cron secret
 */
export async function GET(request: NextRequest) {
  try {
    // Optional: Add authorization check for production
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Find all active rounds that have expired
    const expiredRoundsResult = await sql`
      SELECT 
        id,
        position,
        end_time,
        status
      FROM rounds
      WHERE status = 'active'
      AND end_time < NOW()
      ORDER BY end_time ASC
    `;

    if (expiredRoundsResult.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No expired rounds found',
        finalized: [],
      });
    }

    const finalizationResults = [];
    const errors = [];

    // Process each expired round
    for (const round of expiredRoundsResult) {
      try {
        console.log(`Finalizing round ${round.id} (${round.position})...`);

        // Run finalization algorithm
        const finalizationResult = await finalizeRound(round.id);

        if (!finalizationResult.success) {
          if (finalizationResult.tieDetected) {
            // Tie detected - mark round as requiring tiebreaker
            await sql`
              UPDATE rounds
              SET status = 'tiebreaker',
                  updated_at = NOW()
              WHERE id = ${round.id}
            `;

            errors.push({
              round_id: round.id,
              position: round.position,
              error: 'Tie detected - tiebreaker required',
              tied_bids: finalizationResult.tiedBids?.length || 0,
            });

            console.log(`Tie detected in round ${round.id}. Marked for tiebreaker.`);
            continue;
          }

          errors.push({
            round_id: round.id,
            position: round.position,
            error: finalizationResult.error,
          });

          console.error(`Failed to finalize round ${round.id}:`, finalizationResult.error);
          continue;
        }

        // Apply finalization results to database
        const applyResult = await applyFinalizationResults(
          round.id,
          finalizationResult.allocations
        );

        if (!applyResult.success) {
          errors.push({
            round_id: round.id,
            position: round.position,
            error: applyResult.error,
          });

          console.error(`Failed to apply finalization for round ${round.id}:`, applyResult.error);
          continue;
        }

        // Success
        finalizationResults.push({
          round_id: round.id,
          position: round.position,
          allocations_count: finalizationResult.allocations.length,
          allocations: finalizationResult.allocations.map(alloc => ({
            team_name: alloc.team_name,
            player_name: alloc.player_name,
            amount: alloc.amount,
            phase: alloc.phase,
          })),
        });

        console.log(`Successfully finalized round ${round.id}`);
      } catch (error) {
        console.error(`Error processing round ${round.id}:`, error);
        errors.push({
          round_id: round.id,
          position: round.position,
          error: 'Unexpected error during finalization',
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${expiredRoundsResult.length} expired rounds`,
      finalized: finalizationResults,
      errors: errors.length > 0 ? errors : undefined,
      summary: {
        total_expired: expiredRoundsResult.length,
        successfully_finalized: finalizationResults.length,
        failed_or_tied: errors.length,
      },
    });
  } catch (error) {
    console.error('Error in cron finalize-rounds:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/finalize-rounds
 * Alternative endpoint for POST requests (some cron services prefer POST)
 */
export async function POST(request: NextRequest) {
  return GET(request);
}
