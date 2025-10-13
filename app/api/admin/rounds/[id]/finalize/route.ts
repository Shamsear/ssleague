import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { cookies } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { finalizeRound, applyFinalizationResults } from '@/lib/finalize-round';

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
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify Firebase ID token
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error) {
      console.error('Token verification error:', error);
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    const userId = decodedToken.uid;

    // Get user role from Firestore
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    if (userData?.role !== 'admin' && userData?.role !== 'committee_admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
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

    // Check if round is active
    if (round.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Round is not active' },
        { status: 400 }
      );
    }

    // Run finalization algorithm
    const finalizationResult = await finalizeRound(roundId);

    if (!finalizationResult.success) {
      if (finalizationResult.tieDetected) {
        // Tie detected - tiebreaker created, mark round as 'finalizing'
        await sql`
          UPDATE rounds
          SET status = 'finalizing',
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
