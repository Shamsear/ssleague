import { NextRequest, NextResponse } from 'next/server';
import { getAuctionDb } from '@/lib/neon/auction-config';
import { verifyAuth } from '@/lib/auth-helper';

export async function POST(
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
    const { id: roundId } = await params;

    const sql = getAuctionDb();

    // Get team_id from teams table
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

    // Check if round exists and is active
    const roundResult = await sql`
      SELECT id, position, max_bids_per_team, status, end_time
      FROM rounds
      WHERE id = ${roundId}
    `;

    if (roundResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Round not found' },
        { status: 404 }
      );
    }

    const round = roundResult[0];

    if (round.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Round is not active' },
        { status: 400 }
      );
    }

    // Check if round has ended
    const now = new Date();
    const endTime = new Date(round.end_time);
    if (now > endTime) {
      return NextResponse.json(
        { success: false, error: 'Round has ended' },
        { status: 400 }
      );
    }

    // Get team's bids for this round
    const bidsResult = await sql`
      SELECT id FROM bids
      WHERE team_id = ${teamId}
      AND round_id = ${roundId}
      AND status = 'active'
    `;

    const bidCount = bidsResult.length;

    // Validate bid count matches required amount
    if (bidCount !== round.max_bids_per_team) {
      return NextResponse.json(
        { 
          success: false, 
          error: `You must place exactly ${round.max_bids_per_team} bids. You currently have ${bidCount} bid(s).` 
        },
        { status: 400 }
      );
    }

    // Insert or update submission
    console.log('🔍 [Submit Bids] Submitting bids for team:', teamId, 'round:', roundId, 'bid_count:', bidCount);
    const submissionResult = await sql`
      INSERT INTO bid_submissions (
        team_id,
        round_id,
        bid_count,
        is_locked,
        submitted_at,
        updated_at
      ) VALUES (
        ${teamId},
        ${roundId},
        ${bidCount},
        true,
        NOW(),
        NOW()
      )
      ON CONFLICT (team_id, round_id)
      DO UPDATE SET
        bid_count = ${bidCount},
        is_locked = true,
        submitted_at = NOW(),
        updated_at = NOW()
      RETURNING *
    `;

    console.log('✅ [Submit Bids] Submission successful:', submissionResult[0]);

    return NextResponse.json({
      success: true,
      message: 'Bids submitted successfully',
      data: submissionResult[0],
    });
  } catch (error: any) {
    console.error('Error submitting bids:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Unlock submission (allow modifications)
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
    const { id: roundId } = await params;

    const sql = getAuctionDb();

    // Get team_id
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

    // Delete submission (unlock bids)
    console.log('🔍 [Unlock Bids] Unlocking bids for team:', teamId, 'round:', roundId);
    await sql`
      DELETE FROM bid_submissions
      WHERE team_id = ${teamId}
      AND round_id = ${roundId}
    `;
    console.log('✅ [Unlock Bids] Submission unlocked successfully');

    return NextResponse.json({
      success: true,
      message: 'Submission unlocked - you can now modify your bids',
    });
  } catch (error: any) {
    console.error('Error unlocking submission:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
