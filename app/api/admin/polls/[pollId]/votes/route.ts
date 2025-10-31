import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

/**
 * GET /api/admin/polls/[pollId]/votes
 * Get all votes for a poll with filtering
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { pollId: string } }
) {
  try {
    const { pollId } = params;
    const { searchParams } = new URL(request.url);
    const flagged_only = searchParams.get('flagged_only') === 'true';

    const sql = getTournamentDb();

    let query;
    if (flagged_only) {
      query = sql`
        SELECT 
          vote_id,
          voter_name,
          selected_option_id,
          device_fingerprint,
          ip_address,
          voted_at,
          is_flagged,
          flag_reason
        FROM poll_votes
        WHERE poll_id = ${pollId}
          AND deleted_at IS NULL
          AND is_flagged = TRUE
        ORDER BY voted_at DESC
      `;
    } else {
      query = sql`
        SELECT 
          vote_id,
          voter_name,
          selected_option_id,
          device_fingerprint,
          ip_address,
          voted_at,
          is_flagged,
          flag_reason
        FROM poll_votes
        WHERE poll_id = ${pollId}
          AND deleted_at IS NULL
        ORDER BY voted_at DESC
      `;
    }

    const votes = await query;

    // Get vote counts by option
    const optionStats = await sql`
      SELECT 
        selected_option_id,
        COUNT(*) as vote_count,
        COUNT(CASE WHEN is_flagged THEN 1 END) as flagged_count
      FROM poll_votes
      WHERE poll_id = ${pollId}
        AND deleted_at IS NULL
      GROUP BY selected_option_id
    `;

    // Get duplicate name statistics
    const duplicateNames = await sql`
      SELECT 
        voter_name,
        COUNT(DISTINCT device_fingerprint) as device_count,
        COUNT(*) as vote_count,
        array_agg(DISTINCT device_fingerprint) as devices
      FROM poll_votes
      WHERE poll_id = ${pollId}
        AND deleted_at IS NULL
      GROUP BY voter_name
      HAVING COUNT(DISTINCT device_fingerprint) > 1
      ORDER BY device_count DESC
    `;

    return NextResponse.json({
      success: true,
      votes,
      stats: {
        total_votes: votes.length,
        flagged_votes: votes.filter((v: any) => v.is_flagged).length,
        option_breakdown: optionStats,
        duplicate_names: duplicateNames
      }
    });

  } catch (error: any) {
    console.error('Error fetching poll votes:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/polls/[pollId]/votes
 * Soft delete a vote
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { pollId: string } }
) {
  try {
    const { pollId } = params;
    const { vote_id } = await request.json();

    if (!vote_id) {
      return NextResponse.json(
        { success: false, error: 'vote_id is required' },
        { status: 400 }
      );
    }

    const sql = getTournamentDb();

    // Get vote details before deletion
    const [vote] = await sql`
      SELECT selected_option_id
      FROM poll_votes
      WHERE vote_id = ${vote_id} 
        AND poll_id = ${pollId}
        AND deleted_at IS NULL
    `;

    if (!vote) {
      return NextResponse.json(
        { success: false, error: 'Vote not found' },
        { status: 404 }
      );
    }

    // Soft delete the vote
    await sql`
      UPDATE poll_votes
      SET deleted_at = NOW()
      WHERE vote_id = ${vote_id}
    `;

    // Decrement vote counts
    await sql`
      UPDATE polls
      SET total_votes = GREATEST(0, total_votes - 1)
      WHERE poll_id = ${pollId}
    `;

    // Decrement option vote count
    await sql`
      UPDATE polls
      SET options = (
        SELECT jsonb_agg(
          CASE 
            WHEN elem->>'id' = ${vote.selected_option_id}
            THEN jsonb_set(elem, '{votes}', to_jsonb(GREATEST(0, COALESCE((elem->>'votes')::int, 0) - 1)))
            ELSE elem
          END
        )
        FROM jsonb_array_elements(options) elem
      )
      WHERE poll_id = ${pollId}
    `;

    return NextResponse.json({
      success: true,
      message: 'Vote deleted successfully'
    });

  } catch (error: any) {
    console.error('Error deleting vote:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
