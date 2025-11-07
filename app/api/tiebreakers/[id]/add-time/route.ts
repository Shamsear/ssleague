import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '@/lib/auth-helper';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * POST /api/tiebreakers/:id/add-time
 * Add minutes to a tiebreaker's duration
 * Committee admin only
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication and authorization
    const auth = await verifyAuth(['admin', 'committee_admin']);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const { minutes } = await request.json();

    if (!minutes || minutes <= 0) {
      return NextResponse.json(
        { success: false, error: 'Valid minutes value is required' },
        { status: 400 }
      );
    }

    // Fetch the current tiebreaker
    const tiebreakers = await sql`
      SELECT id, duration_minutes, status, created_at FROM tiebreakers WHERE id = ${id} LIMIT 1
    `;

    if (tiebreakers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tiebreaker not found' },
        { status: 404 }
      );
    }

    const tiebreaker = tiebreakers[0];

    if (tiebreaker.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Can only add time to active tiebreakers' },
        { status: 400 }
      );
    }

    // Update duration_minutes by adding the specified minutes
    const currentDuration = tiebreaker.duration_minutes || 0;
    const newDuration = currentDuration + minutes;

    const updatedTiebreaker = await sql`
      UPDATE tiebreakers 
      SET 
        duration_minutes = ${newDuration},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    // Broadcast WebSocket event if available
    if (typeof global.wsBroadcast === 'function') {
      global.wsBroadcast(`tiebreaker:${id}`, {
        type: 'tiebreaker_time_extended',
        data: { 
          tiebreakerId: id, 
          minutesAdded: minutes,
          newDurationMinutes: newDuration
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: updatedTiebreaker[0],
      message: `Added ${minutes} minute(s) to tiebreaker`,
    });

  } catch (error: any) {
    console.error('Error adding time to tiebreaker:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
