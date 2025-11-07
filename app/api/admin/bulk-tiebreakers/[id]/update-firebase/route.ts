import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '@/lib/auth-helper';
import { adminDb } from '@/lib/firebase/admin';
import { logAuctionWin } from '@/lib/transaction-logger';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * POST /api/admin/bulk-tiebreakers/:id/update-firebase
 * Update Firebase for an already-finalized tiebreaker
 * Use when PostgreSQL finalized but Firebase failed
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ ZERO FIREBASE READS - Uses JWT claims only
    const auth = await verifyAuth(['admin', 'committee', 'committee_admin'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: tiebreakerId } = await params;

    // Get tiebreaker details
    const tiebreakerResult = await sql`
      SELECT 
        id,
        player_id,
        player_name,
        player_position as position,
        bulk_round_id as round_id,
        current_highest_bid,
        current_highest_team_id,
        status
      FROM bulk_tiebreakers
      WHERE id = ${tiebreakerId}
    `;

    if (tiebreakerResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tiebreaker not found' },
        { status: 404 }
      );
    }

    const tiebreaker = tiebreakerResult[0];

    if (tiebreaker.status !== 'resolved') {
      return NextResponse.json(
        { success: false, error: `Tiebreaker not resolved (status: ${tiebreaker.status})` },
        { status: 400 }
      );
    }

    // Get round and season
    const roundResult = await sql`
      SELECT season_id FROM rounds WHERE id = ${tiebreaker.round_id}
    `;

    if (roundResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Round not found' },
        { status: 404 }
      );
    }

    const seasonId = roundResult[0].season_id;
    const winningAmount = tiebreaker.current_highest_bid;
    const winnerTeamId = tiebreaker.current_highest_team_id;

    // Update Firebase
    const teamSeasonId = `${winnerTeamId}_${seasonId}`;
    const teamSeasonRef = adminDb.collection('team_seasons').doc(teamSeasonId);
    const teamSeasonSnap = await teamSeasonRef.get();

    if (!teamSeasonSnap.exists) {
      return NextResponse.json(
        { success: false, error: `Team season ${teamSeasonId} not found` },
        { status: 404 }
      );
    }

    const teamSeasonData = teamSeasonSnap.data()!;

    const currentFootballBudget = teamSeasonData?.football_budget || 0;
    const currentFootballSpent = teamSeasonData?.football_spent || 0;
    const newFootballBudget = currentFootballBudget - winningAmount;
    const newFootballSpent = currentFootballSpent + winningAmount;

    const positionCounts = teamSeasonData?.position_counts || {};
    const currentPositionCount = positionCounts[tiebreaker.position] || 0;
    const newPositionCounts = {
      ...positionCounts,
      [tiebreaker.position]: currentPositionCount + 1
    };

    await teamSeasonRef.update({
      football_budget: newFootballBudget,
      football_spent: newFootballSpent,
      position_counts: newPositionCounts,
      updated_at: new Date()
    });

    // Log transaction
    await logAuctionWin(
      winnerTeamId,
      seasonId,
      tiebreaker.player_name || 'Unknown Player',
      tiebreaker.player_id,
      'football',
      winningAmount,
      currentFootballBudget,
      tiebreaker.round_id
    );

    return NextResponse.json({
      success: true,
      data: {
        tiebreaker_id: tiebreakerId,
        player_name: tiebreaker.player_name,
        winner_team_id: winnerTeamId,
        winning_amount: winningAmount,
        updates: {
          football_budget: `£${currentFootballBudget} → £${newFootballBudget}`,
          football_spent: `£${currentFootballSpent} → £${newFootballSpent}`,
          position_count: `${tiebreaker.position}: ${currentPositionCount} → ${currentPositionCount + 1}`
        },
        message: 'Firebase updated successfully!'
      }
    });

  } catch (error: any) {
    console.error('Error updating Firebase:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
