import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { cookies } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { getISTNow, toNeonTimestamp, formatISTDateTime } from '@/lib/utils/timezone';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * POST /api/admin/bulk-rounds/:id/start
 * Start a bulk bidding round (set status to active, set start/end times)
 * Committee admin only
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

    // Check if user is committee admin
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
        { success: false, error: 'Access denied. Committee admin only.' },
        { status: 403 }
      );
    }

    const { id: roundId } = await params;

    console.log(`🚀 Starting bulk round ${roundId}`);

    // Get round details
    const roundCheck = await sql`
      SELECT id, status, duration_seconds, round_number
      FROM rounds
      WHERE id = ${roundId}
      AND round_type = 'bulk'
    `;

    if (roundCheck.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Bulk round not found' },
        { status: 404 }
      );
    }

    const round = roundCheck[0];

    if (round.status !== 'draft') {
      return NextResponse.json(
        { success: false, error: `Cannot start round. Current status: ${round.status}` },
        { status: 400 }
      );
    }

    // Start the round using IST
    const startTime = getISTNow();
    const endTime = new Date(startTime.getTime() + round.duration_seconds * 1000);

    await sql`
      UPDATE rounds
      SET 
        status = 'active',
        start_time = ${toNeonTimestamp(startTime)},
        end_time = ${toNeonTimestamp(endTime)},
        updated_at = NOW()
      WHERE id = ${roundId}
    `;

    console.log(`✅ Bulk round ${round.round_number} started`);
    console.log(`⏰ Start (IST): ${formatISTDateTime(startTime)}`);
    console.log(`⏰ End (IST): ${formatISTDateTime(endTime)}`);

    // TODO: Send notifications to all teams (implement later)
    // - Email notification
    // - In-app notification
    // - WebSocket broadcast

    return NextResponse.json({
      success: true,
      data: {
        round_id: roundId,
        round_number: round.round_number,
        status: 'active',
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        duration_seconds: round.duration_seconds,
        message: `Bulk round ${round.round_number} has been started. Teams can now place bids.`,
      },
    });

  } catch (error: any) {
    console.error('❌ Error starting bulk round:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
