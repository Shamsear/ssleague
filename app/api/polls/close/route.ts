import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { generatePollResultsNews, shouldGenerateNewsForPoll } from '@/lib/polls/results-news';
import { sendNotificationToSeason } from '@/lib/notifications/send-notification';

/**
 * POST /api/polls/close
 * Close polls that have passed their closing time
 * 
 * This endpoint can be called:
 * 1. Via a cron job every hour
 * 2. Manually by admins to force close polls
 * 
 * Body (optional):
 * - poll_id?: string - Close a specific poll
 * - force?: boolean - Force close even if not past closes_at
 */
export async function POST(request: NextRequest) {
  try {
    const sql = getTournamentDb();
    const body = await request.json().catch(() => ({}));
    const { poll_id, poll_ids, force = false } = body;

    // Case 1: Close specific polls (array)
    if (poll_ids && Array.isArray(poll_ids)) {
      const closedIds: string[] = [];
      
      for (const id of poll_ids) {
        try {
          const [poll] = await sql`
            SELECT id, is_closed, closes_at FROM polls WHERE id = ${id}
          `;
          
          if (!poll || poll.is_closed) continue;
          
          const now = new Date();
          const closesAt = poll.closes_at ? new Date(poll.closes_at) : null;
          
          if (!force && closesAt && closesAt > now) continue;
          
          await sql`
            UPDATE polls
            SET is_closed = true, closed_at = NOW(), updated_at = NOW()
            WHERE id = ${id}
          `;
          
          await calculatePollResults(id);
          closedIds.push(id);
        } catch (error) {
          console.error(`Failed to close poll ${id}:`, error);
        }
      }
      
      return NextResponse.json({
        success: true,
        message: `Closed ${closedIds.length} polls`,
        closed_count: closedIds.length,
        poll_ids: closedIds,
      });
    }

    // Case 2: Close a single specific poll
    if (poll_id) {
      const [poll] = await sql`
        SELECT id, question_en, closes_at, is_closed
        FROM polls
        WHERE id = ${poll_id}
      `;

      if (!poll) {
        return NextResponse.json(
          { success: false, error: 'Poll not found' },
          { status: 404 }
        );
      }

      if (poll.is_closed) {
        return NextResponse.json(
          { success: false, error: 'Poll is already closed' },
          { status: 400 }
        );
      }

      // Check if poll should be closed
      const now = new Date();
      const closesAt = poll.closes_at ? new Date(poll.closes_at) : null;
      
      if (!force && closesAt && closesAt > now) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Poll has not reached closing time yet',
            closes_at: closesAt.toISOString()
          },
          { status: 400 }
        );
      }

      // Close the poll
      await sql`
        UPDATE polls
        SET is_closed = true,
            closed_at = NOW(),
            updated_at = NOW()
        WHERE id = ${poll_id}
      `;

      // Calculate final results
      await calculatePollResults(poll_id);

      console.log('✅ Poll closed:', poll_id);

      return NextResponse.json({
        success: true,
        message: 'Poll closed successfully',
        poll_id,
      });
    }

    // Case 2: Close all expired polls
    const now = new Date().toISOString();
    
    // Find all polls that should be closed
    const expiredPolls = await sql`
      SELECT id, question_en, closes_at
      FROM polls
      WHERE is_closed = false
        AND closes_at IS NOT NULL
        AND closes_at <= ${now}
    `;

    if (expiredPolls.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No polls to close',
        closed_count: 0,
      });
    }

    console.log(`🔒 Closing ${expiredPolls.length} expired polls...`);

    // Close all expired polls
    const closedPollIds: string[] = [];
    
    for (const poll of expiredPolls) {
      try {
        // Close the poll
        await sql`
          UPDATE polls
          SET is_closed = true,
              closed_at = NOW(),
              updated_at = NOW()
          WHERE id = ${poll.id}
        `;

        // Calculate final results
        await calculatePollResults(poll.id);
        
        closedPollIds.push(poll.id);
        console.log(`✅ Closed poll: ${poll.id} - ${poll.question_en}`);
      } catch (error) {
        console.error(`❌ Failed to close poll ${poll.id}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Closed ${closedPollIds.length} polls`,
      closed_count: closedPollIds.length,
      poll_ids: closedPollIds,
    });
  } catch (error: any) {
    console.error('Error closing polls:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to close polls',
      },
      { status: 500 }
    );
  }
}

/**
 * Calculate and update final results for a poll
 */
async function calculatePollResults(pollId: string): Promise<void> {
  const sql = getTournamentDb();

  try {
    // Get vote counts for each option
    const voteCounts = await sql`
      SELECT 
        option_id,
        COUNT(*) as vote_count
      FROM poll_votes
      WHERE poll_id = ${pollId}
      GROUP BY option_id
    `;

    // Calculate total votes
    const totalVotes = voteCounts.reduce((sum: number, row: any) => sum + parseInt(row.vote_count), 0);

    // Update poll total votes
    await sql`
      UPDATE polls
      SET total_votes = ${totalVotes}
      WHERE id = ${pollId}
    `;

    // Update option vote counts
    for (const row of voteCounts) {
      await sql`
        UPDATE poll_options
        SET votes = ${parseInt(row.vote_count)}
        WHERE poll_id = ${pollId}
          AND id = ${row.option_id}
      `;
    }

    // Calculate percentages and determine winner
    if (totalVotes > 0) {
      const results = voteCounts.map((row: any) => ({
        option_id: row.option_id,
        votes: parseInt(row.vote_count),
        percentage: Math.round((parseInt(row.vote_count) / totalVotes) * 100),
      }));

      // Sort by votes to find winner
      results.sort((a, b) => b.votes - a.votes);
      const winner = results[0];

      // Store results
      await sql`
        INSERT INTO poll_results (
          poll_id, option_id, vote_count, percentage, is_winner
        )
        SELECT 
          ${pollId},
          id,
          votes,
          CASE 
            WHEN ${totalVotes} > 0 
            THEN ROUND((votes::float / ${totalVotes}) * 100) 
            ELSE 0 
          END as percentage,
          CASE WHEN id = ${winner.option_id} THEN true ELSE false END as is_winner
        FROM poll_options
        WHERE poll_id = ${pollId}
        ON CONFLICT (poll_id, option_id) 
        DO UPDATE SET
          vote_count = EXCLUDED.vote_count,
          percentage = EXCLUDED.percentage,
          is_winner = EXCLUDED.is_winner,
          updated_at = NOW()
      `;

      console.log(`📊 Results calculated for poll ${pollId}: Winner option ${winner.option_id} with ${winner.votes} votes (${winner.percentage}%)`);
      
      // Send FCM notification for poll closure
      try {
        const [poll] = await sql`
          SELECT poll_type, question_en, season_id FROM polls WHERE id = ${pollId}
        `;
        
        if (poll && poll.season_id) {
          // Get winner option text
          const [winnerOption] = await sql`
            SELECT text_en FROM poll_options WHERE id = ${winner.option_id}
          `;
          
          await sendNotificationToSeason(
            {
              title: '📊 Poll Closed!',
              body: `"${poll.question_en}" - Winner: ${winnerOption?.text_en || 'See results'} (${winner.percentage}%)`,
              url: `/polls/${pollId}`,
              icon: '/logo.png',
              data: {
                type: 'poll_closed',
                poll_id: pollId,
                poll_type: poll.poll_type,
                winner_votes: winner.votes.toString(),
                winner_percentage: winner.percentage.toString(),
              }
            },
            poll.season_id
          );
        }
      } catch (notifError) {
        console.error('Failed to send poll closure notification:', notifError);
      }
      
      // Generate news for major polls (async, non-blocking)
      const [poll] = await sql`
        SELECT poll_type FROM polls WHERE id = ${pollId}
      `;
      
      if (poll && shouldGenerateNewsForPoll(poll.poll_type)) {
        generatePollResultsNews(pollId).catch(err => {
          console.error(`Failed to generate news for poll ${pollId}:`, err);
        });
      }
    }
  } catch (error) {
    console.error(`Error calculating results for poll ${pollId}:`, error);
    throw error;
  }
}

/**
 * GET /api/polls/close
 * Check which polls need to be closed
 */
export async function GET(request: NextRequest) {
  try {
    const sql = getTournamentDb();
    const { searchParams } = new URL(request.url);
    const checkOnly = searchParams.get('check_only') === 'true';

    const now = new Date().toISOString();
    
    // Find polls that should be closed
    const expiredPolls = await sql`
      SELECT 
        id, poll_type, question_en, closes_at, 
        total_votes, is_closed
      FROM polls
      WHERE is_closed = false
        AND closes_at IS NOT NULL
        AND closes_at <= ${now}
      ORDER BY closes_at ASC
    `;

    // Also get polls closing soon (within next 24 hours)
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const closingSoon = await sql`
      SELECT 
        id, poll_type, question_en, closes_at, 
        total_votes, is_closed
      FROM polls
      WHERE is_closed = false
        AND closes_at IS NOT NULL
        AND closes_at > ${now}
        AND closes_at <= ${tomorrow}
      ORDER BY closes_at ASC
    `;

    return NextResponse.json({
      success: true,
      expired_polls: expiredPolls,
      expired_count: expiredPolls.length,
      closing_soon: closingSoon,
      closing_soon_count: closingSoon.length,
      check_only: checkOnly,
    });
  } catch (error: any) {
    console.error('Error checking polls:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check polls' },
      { status: 500 }
    );
  }
}
