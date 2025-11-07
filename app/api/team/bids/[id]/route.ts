import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '@/lib/auth-helper';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(['team'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = auth.userId!;

    const { id: bidId } = await params;

    // Get team_id from teams table using Firebase UID
    const teamResult = await sql`
      SELECT id FROM teams WHERE firebase_uid = ${userId} LIMIT 1
    `;

    if (teamResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Team not found' },
        { status: 404 }
      );
    }

    const teamId = teamResult[0].id;

    // Handle temporary/optimistic IDs from client-side
    if (bidId.startsWith('temp-')) {
      return NextResponse.json({
        success: true,
        message: 'Optimistic bid cancelled (not yet in database)',
      });
    }

    // Get bid details
    const bidResult = await sql`
      SELECT 
        b.id,
        b.team_id,
        b.round_id,
        b.status,
        r.status as round_status,
        r.end_time
      FROM bids b
      JOIN rounds r ON b.round_id = r.id
      WHERE b.id = ${bidId}
    `;

    if (bidResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Bid not found' },
        { status: 404 }
      );
    }

    const bid = bidResult[0];

    // Check if bid belongs to the user's team
    if (bid.team_id !== teamId) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to cancel this bid' },
        { status: 403 }
      );
    }

    // Check if bid is already cancelled
    if (bid.status === 'cancelled') {
      return NextResponse.json(
        { success: false, error: 'Bid is already cancelled' },
        { status: 400 }
      );
    }

    // Check if bid is already won
    if (bid.status === 'won') {
      return NextResponse.json(
        { success: false, error: 'Cannot cancel a winning bid' },
        { status: 400 }
      );
    }

    // Check if bid is already lost
    if (bid.status === 'lost') {
      return NextResponse.json(
        { success: false, error: 'Cannot cancel a lost bid' },
        { status: 400 }
      );
    }

    // Check if round is still active
    if (bid.round_status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Round is no longer active' },
        { status: 400 }
      );
    }

    // Check if round has ended
    const now = new Date();
    const endTime = new Date(bid.end_time);
    if (now > endTime) {
      return NextResponse.json(
        { success: false, error: 'Round has ended' },
        { status: 400 }
      );
    }

    // Actually DELETE the bid from database
    const deleteResult = await sql`
      DELETE FROM bids 
      WHERE id = ${bidId}
      RETURNING id
    `;

    if (deleteResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete bid' },
        { status: 500 }
      );
    }

    console.log(`✅ Bid ${bidId} deleted successfully for team ${teamId}`);

    return NextResponse.json({
      success: true,
      message: 'Bid deleted successfully',
    });
  } catch (error) {
    console.error('Error cancelling bid:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
