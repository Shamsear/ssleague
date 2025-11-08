import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '@/lib/auth-helper';
import { broadcastRoundUpdate } from '@/lib/realtime/broadcast';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * POST /api/rounds/:id/add-time
 * Add minutes to an existing round's end time
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

    // Fetch the current round
    const rounds = await sql`
      SELECT id, end_time, status FROM rounds WHERE id = ${id} LIMIT 1
    `;

    if (rounds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Round not found' },
        { status: 404 }
      );
    }

    const round = rounds[0];

    // Update end_time by adding the specified minutes
    // Use sql.unsafe for interval concatenation since tagged template can't handle it
    const updatedRound = await sql`
      UPDATE rounds 
      SET 
        end_time = end_time + (${minutes} || ' minutes')::interval,
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    // Broadcast via Firebase Realtime DB
    const seasonResult = await sql`SELECT season_id FROM rounds WHERE id = ${id}`;
    const seasonId = seasonResult[0]?.season_id;
    
    if (seasonId) {
      await broadcastRoundUpdate(seasonId, id, {
        type: 'round_updated',
        end_time: updatedRound[0].end_time,
        duration_seconds: updatedRound[0].duration_seconds,
        time_extended: true,
        minutes_added: minutes,
      });
    }

    return NextResponse.json({
      success: true,
      data: updatedRound[0],
      message: `Added ${minutes} minute(s) to round`,
    });

  } catch (error: any) {
    console.error('Error adding time to round:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
