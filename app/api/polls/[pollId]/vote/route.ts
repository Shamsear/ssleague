import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

/**
 * POST /api/polls/[pollId]/vote
 * Submit a vote with device tracking and name validation
 * Frontend handles authentication - backend validates vote data
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
      voter_email,
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

    // Get IP address from request
    const ip_address = request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';

    // STRICT CHECK: Has this device already voted?
    const existingVote = await sql`
      SELECT vote_id, voter_name, selected_option_id
      FROM poll_votes
      WHERE poll_id = ${pollId}
        AND device_fingerprint = ${device_fingerprint}
        AND deleted_at IS NULL
    `;

    if (existingVote.length > 0) {
      const existing = existingVote[0];

      return NextResponse.json(
        {
          success: false,
          error: `This device has already voted as "${existing.voter_name}"`,
          already_voted: true,
          voter_name: existing.voter_name,
          selected_option: existing.selected_option_id
        },
        { status: 400 }
      );
    }

    // Check if name was used on other devices (flag for admin review)
    const nameUsage = await sql`
      SELECT COUNT(DISTINCT device_fingerprint) as device_count
      FROM poll_votes
      WHERE poll_id = ${pollId}
        AND voter_name = ${voter_name.trim()}
        AND deleted_at IS NULL
    `;

    const shouldFlag = nameUsage[0]?.device_count >= 1;

    // Create vote
    const vote_id = `vote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Generate user_id from voter email (authenticated users only from frontend)
    // Email is validated on frontend via Firebase Auth
    const userId = voter_email ? `user_${Buffer.from(voter_email).toString('base64').slice(0, 20)}` : `anon_${device_fingerprint.slice(0, 20)}`;
    
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
        ${ip_address},
        ${user_agent || null},
        ${browser_info ? JSON.stringify(browser_info) : null},
        ${selected_option_id},
        NOW(),
        ${shouldFlag},
        ${shouldFlag ? 'duplicate_name_multiple_devices' : null}
      )
    `;

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

    // If flagged, create flag entry
    if (shouldFlag) {
      await sql`
        INSERT INTO poll_vote_flags (
          poll_id, voter_name, flag_reason, device_count
        ) VALUES (
          ${pollId},
          ${voter_name.trim()},
          'duplicate_name_multiple_devices',
          ${(nameUsage[0]?.device_count || 0) + 1}
        )
        ON CONFLICT (poll_id, voter_name)
        DO UPDATE SET
          device_count = ${(nameUsage[0]?.device_count || 0) + 1},
          flagged_at = NOW()
      `;
    }

    console.log(`✅ Vote recorded: ${voter_name} voted for option ${selected_option_id}${shouldFlag ? ' (flagged)' : ''}`);

    return NextResponse.json({
      success: true,
      message: 'Vote recorded successfully',
      vote_id,
      flagged: shouldFlag,
      flag_message: shouldFlag ? 'Your vote has been recorded but flagged for admin review due to duplicate name usage.' : null
    });

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
 * Check if device has already voted
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pollId: string }> }
) {
  try {
    const { pollId } = await params;
    const { searchParams } = new URL(request.url);
    const device_fingerprint = searchParams.get('device_fingerprint');

    if (!device_fingerprint) {
      return NextResponse.json(
        { success: false, error: 'device_fingerprint parameter required' },
        { status: 400 }
      );
    }

    const sql = getTournamentDb();

    const existingVote = await sql`
      SELECT vote_id, voter_name, selected_option_id, voted_at, is_flagged
      FROM poll_votes
      WHERE poll_id = ${pollId}
        AND device_fingerprint = ${device_fingerprint}
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
