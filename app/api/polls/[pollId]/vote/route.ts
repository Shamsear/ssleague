import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

/**
 * POST /api/polls/[pollId]/vote
 * Submit a vote with device tracking and name validation
 * No authentication required - uses name + device fingerprint
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pollId: string }> }
) {
  try {
    const { pollId } = await params;
    const body = await request.json();

    const {
      selected_option_id,
      voter_name,
      device_fingerprint,
      user_agent,
      browser_info,
    } = body;

    // Validation: selected option
    if (!selected_option_id) {
      return NextResponse.json(
        { success: false, error: 'selected_option_id is required' },
        { status: 400 }
      );
    }

    // Validation: voter name
    if (!voter_name || voter_name.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: 'Please enter your name (minimum 3 characters)' },
        { status: 400 }
      );
    }

    // Validation: device fingerprint
    if (!device_fingerprint) {
      return NextResponse.json(
        { success: false, error: 'Device fingerprint is required' },
        { status: 400 }
      );
    }

    // Validate name format (only letters and spaces)
    const nameRegex = /^[a-zA-Z\s]+$/;
    if (!nameRegex.test(voter_name.trim())) {
      return NextResponse.json(
        { success: false, error: 'Name can only contain letters and spaces' },
        { status: 400 }
      );
    }

    // Block common fake names
    const fakenames = ['test', 'asdf', 'qwerty', 'abc', 'xyz', 'admin', 'user', 'demo'];
    const lowerName = voter_name.toLowerCase().trim();
    if (fakenames.some(fake => lowerName.includes(fake))) {
      return NextResponse.json(
        { success: false, error: 'Please use your real name' },
        { status: 400 }
      );
    }

    const sql = getTournamentDb();

    // Check if poll exists and is active
    const [poll] = await sql`
      SELECT poll_id, status, closes_at, options
      FROM polls
      WHERE poll_id = ${pollId}
    `;

    if (!poll) {
      return NextResponse.json(
        { success: false, error: 'Poll not found' },
        { status: 404 }
      );
    }

    if (poll.status === 'closed') {
      return NextResponse.json(
        { success: false, error: 'This poll is closed' },
        { status: 400 }
      );
    }

    // Check if poll has expired
    if (poll.closes_at && new Date(poll.closes_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'This poll has expired' },
        { status: 400 }
      );
    }

    // Validate selected option exists
    const options = poll.options as any[];
    const optionExists = options.some((opt: any) => opt.id === selected_option_id);
    if (!optionExists) {
      return NextResponse.json(
        { success: false, error: 'Invalid option selected' },
        { status: 400 }
      );
    }

    // Generate user_id from voter name + device fingerprint (no IP tracking)
    const userId = `user_${Buffer.from(voter_name.toLowerCase().trim() + device_fingerprint).toString('base64').slice(0, 20)}`;


    // Use a transaction to handle race conditions
    // This ensures that even if two different users vote at the exact same time,
    // both votes will be recorded correctly
    try {
      // PRIMARY CHECK: Has this user (by email/user_id) already voted?
      const existingVoteByUser = await sql`
        SELECT vote_id, voter_name, selected_option_id
        FROM poll_votes
        WHERE poll_id = ${pollId}
          AND user_id = ${userId}
          AND deleted_at IS NULL
      `;

      if (existingVoteByUser.length > 0) {
        const existing = existingVoteByUser[0];

        return NextResponse.json(
          {
            success: false,
            error: `You have already voted in this poll as "${existing.voter_name}"`,
            already_voted: true,
            voter_name: existing.voter_name,
            selected_option: existing.selected_option_id
          },
          { status: 400 }
        );
      }

      // SECONDARY CHECK: Has this device been used by a different user?
      const existingVoteByDevice = await sql`
        SELECT vote_id, voter_name, user_id
        FROM poll_votes
        WHERE poll_id = ${pollId}
          AND device_fingerprint = ${device_fingerprint}
          AND user_id != ${userId}
          AND deleted_at IS NULL
      `;

      const shouldFlag = existingVoteByDevice.length > 0;

      // Create vote with unique vote_id to prevent conflicts
      const vote_id = `vote_${pollId}_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Insert vote - this will fail if somehow the same user_id tries to vote twice simultaneously
      // due to the unique constraint on (poll_id, user_id)
      await sql`
        INSERT INTO poll_votes (
          vote_id, poll_id, user_id, voter_name, user_name,
          device_fingerprint, ip_address, user_agent, browser_info,
          selected_option_id, voted_at,
          is_flagged, flag_reason
        ) VALUES (
          ${vote_id},
          ${pollId},
          ${userId},
          ${voter_name.trim()},
          ${voter_name.trim()},
          ${device_fingerprint},
          ${null},
          ${user_agent || null},
          ${browser_info ? JSON.stringify(browser_info) : null},
          ${selected_option_id},
          NOW(),
          ${shouldFlag},
          ${shouldFlag ? 'shared_device_different_users' : null}
        )
        ON CONFLICT (poll_id, user_id) DO NOTHING
      `;

      // Check if the insert was successful
      const insertCheck = await sql`
        SELECT vote_id FROM poll_votes WHERE vote_id = ${vote_id}
      `;

      if (insertCheck.length === 0) {
        // Vote was not inserted due to conflict - user already voted
        return NextResponse.json(
          {
            success: false,
            error: 'You have already voted in this poll',
            already_voted: true
          },
          { status: 400 }
        );
      }

      // Update total votes count
      await sql`
        UPDATE polls
        SET total_votes = total_votes + 1,
            updated_at = NOW()
        WHERE poll_id = ${pollId}
      `;

      // Update option votes in options JSONB
      await sql`
        UPDATE polls
        SET options = (
          SELECT jsonb_agg(
            CASE 
              WHEN elem->>'id' = ${selected_option_id}
              THEN jsonb_set(elem, '{votes}', to_jsonb(COALESCE((elem->>'votes')::int, 0) + 1))
              ELSE elem
            END
          )
          FROM jsonb_array_elements(options) elem
        )
        WHERE poll_id = ${pollId}
      `;

      // If flagged, log the shared device usage
      if (shouldFlag) {
        console.log(`⚠️ Flagged vote: Multiple users on same device for poll ${pollId}`);
      }

      console.log(`✅ Vote recorded: ${voter_name} voted for option ${selected_option_id}${shouldFlag ? ' (flagged)' : ''}`);

      return NextResponse.json({
        success: true,
        message: 'Vote recorded successfully',
        vote_id,
        flagged: shouldFlag,
        flag_message: shouldFlag ? 'Your vote has been recorded but flagged for admin review due to shared device usage.' : null
      });

    } catch (dbError: any) {
      // Handle database constraint violations
      if (dbError.code === '23505') { // Unique constraint violation
        return NextResponse.json(
          {
            success: false,
            error: 'You have already voted in this poll',
            already_voted: true
          },
          { status: 400 }
        );
      }
      throw dbError;
    }

  } catch (error: any) {
    console.error('Error recording vote:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to record vote' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/polls/[pollId]/vote
 * Check if user has already voted (by name + device fingerprint)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pollId: string }> }
) {
  try {
    const { pollId } = await params;
    const { searchParams } = new URL(request.url);
    const voter_name = searchParams.get('voter_name');
    const device_fingerprint = searchParams.get('device_fingerprint');

    if (!voter_name || !device_fingerprint) {
      return NextResponse.json(
        { success: false, error: 'voter_name and device_fingerprint parameters required' },
        { status: 400 }
      );
    }

    const sql = getTournamentDb();

    // Generate user_id from name + device fingerprint
    const userId = `user_${Buffer.from(voter_name.toLowerCase().trim() + device_fingerprint).toString('base64').slice(0, 20)}`;

    const existingVote = await sql`
      SELECT vote_id, voter_name, selected_option_id, voted_at, is_flagged
      FROM poll_votes
      WHERE poll_id = ${pollId}
        AND user_id = ${userId}
        AND deleted_at IS NULL
    `;

    if (existingVote.length > 0) {
      return NextResponse.json({
        success: true,
        has_voted: true,
        vote: existingVote[0]
      });
    }

    return NextResponse.json({
      success: true,
      has_voted: false
    });

  } catch (error: any) {
    console.error('Error checking vote status:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
