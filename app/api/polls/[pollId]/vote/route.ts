import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

/**
 * POST /api/polls/[pollId]/vote
 * Submit a vote on a poll
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { pollId: string } }
) {
  try {
    const { user_id, user_name, option_id } = await request.json();
    const poll_id = params.pollId;
    
    if (!user_id || !option_id) {
      return NextResponse.json(
        { success: false, error: 'Missing user_id or option_id' },
        { status: 400 }
      );
    }
    
    const sql = getTournamentDb();
    
    // Check if poll exists and is still active
    const pollCheck = await sql`
      SELECT status, closes_at, options FROM polls 
      WHERE poll_id = ${poll_id}
    `;
    
    if (pollCheck.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Poll not found' },
        { status: 404 }
      );
    }
    
    const poll = pollCheck[0];
    
    if (poll.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Poll is closed' },
        { status: 400 }
      );
    }
    
    if (new Date(poll.closes_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Poll has expired' },
        { status: 400 }
      );
    }
    
    // Validate option_id exists in poll options
    const options = poll.options as any[];
    const optionExists = options.some(opt => opt.id === option_id);
    
    if (!optionExists) {
      return NextResponse.json(
        { success: false, error: 'Invalid option_id' },
        { status: 400 }
      );
    }
    
    const vote_id = `vote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Check if user already voted
    const existingVote = await sql`
      SELECT vote_id, selected_option_id FROM poll_votes
      WHERE poll_id = ${poll_id} AND user_id = ${user_id}
    `;
    
    if (existingVote.length > 0) {
      // User already voted - update their vote
      const oldOptionId = existingVote[0].selected_option_id;
      
      // Update vote record
      await sql`
        UPDATE poll_votes
        SET selected_option_id = ${option_id}, voted_at = NOW()
        WHERE poll_id = ${poll_id} AND user_id = ${user_id}
      `;
      
      // Update vote counts in options JSON
      // Decrement old option, increment new option
      const updatedOptions = options.map(opt => {
        if (opt.id === oldOptionId) {
          return { ...opt, votes: Math.max(0, opt.votes - 1) };
        }
        if (opt.id === option_id) {
          return { ...opt, votes: opt.votes + 1 };
        }
        return opt;
      });
      
      await sql`
        UPDATE polls
        SET options = ${JSON.stringify(updatedOptions)}
        WHERE poll_id = ${poll_id}
      `;
      
      console.log(`✅ Updated vote for user ${user_id} on poll ${poll_id}`);
      
      return NextResponse.json({
        success: true,
        message: 'Vote updated successfully',
        vote_changed: true
      });
    } else {
      // New vote
      await sql`
        INSERT INTO poll_votes (vote_id, poll_id, user_id, user_name, selected_option_id)
        VALUES (${vote_id}, ${poll_id}, ${user_id}, ${user_name || null}, ${option_id})
      `;
      
      // Update vote counts in options JSON
      const updatedOptions = options.map(opt => {
        if (opt.id === option_id) {
          return { ...opt, votes: opt.votes + 1 };
        }
        return opt;
      });
      
      // Update total votes and options
      await sql`
        UPDATE polls
        SET 
          options = ${JSON.stringify(updatedOptions)},
          total_votes = total_votes + 1
        WHERE poll_id = ${poll_id}
      `;
      
      console.log(`✅ New vote from user ${user_id} on poll ${poll_id}`);
      
      return NextResponse.json({
        success: true,
        message: 'Vote submitted successfully',
        vote_changed: false
      });
    }
  } catch (error: any) {
    console.error('Error submitting vote:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/polls/[pollId]/vote
 * Check if user has voted and what they voted for
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { pollId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get('user_id');
    
    if (!user_id) {
      return NextResponse.json(
        { success: false, error: 'Missing user_id' },
        { status: 400 }
      );
    }
    
    const sql = getTournamentDb();
    const poll_id = params.pollId;
    
    const vote = await sql`
      SELECT selected_option_id, voted_at
      FROM poll_votes
      WHERE poll_id = ${poll_id} AND user_id = ${user_id}
    `;
    
    if (vote.length === 0) {
      return NextResponse.json({
        success: true,
        has_voted: false
      });
    }
    
    return NextResponse.json({
      success: true,
      has_voted: true,
      selected_option_id: vote[0].selected_option_id,
      voted_at: vote[0].voted_at
    });
  } catch (error: any) {
    console.error('Error checking vote:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
