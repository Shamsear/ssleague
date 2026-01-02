import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

/**
 * GET /api/polls/[pollId]/voters
 * Get list of voters for a specific poll option
 * Query params: option_id
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pollId: string }> }
) {
  try {
    const { pollId } = await params;
    const { searchParams } = new URL(request.url);
    const optionId = searchParams.get('option_id');

    if (!optionId) {
      return NextResponse.json(
        { success: false, error: 'option_id parameter required' },
        { status: 400 }
      );
    }

    const sql = getTournamentDb();

    // Fetch voters for this option
    const voters = await sql`
      SELECT 
        voter_name,
        voted_at,
        is_flagged,
        flag_reason,
        device_fingerprint
      FROM poll_votes
      WHERE poll_id = ${pollId}
        AND selected_option_id = ${optionId}
        AND deleted_at IS NULL
      ORDER BY voted_at DESC
    `;

    return NextResponse.json({
      success: true,
      voters: voters.map(v => ({
        voter_name: v.voter_name,
        voted_at: v.voted_at,
        is_flagged: v.is_flagged,
        flag_reason: v.flag_reason,
        // Don't expose full device fingerprint for privacy
        device_id: v.device_fingerprint?.slice(0, 8) + '...'
      }))
    });

  } catch (error: any) {
    console.error('Error fetching voters:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch voters' },
      { status: 500 }
    );
  }
}
