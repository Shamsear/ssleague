import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { cookies } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { encryptBidData } from '@/lib/encryption';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { player_id, round_id, amount } = body;

    // Validate input
    if (!player_id || !round_id || !amount) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (amount < 10) {
      return NextResponse.json(
        { success: false, error: 'Bid amount must be at least £10' },
        { status: 400 }
      );
    }

    const teamId = userId;

    // Get round details
    const roundResult = await sql`
      SELECT 
        r.id,
        r.position,
        r.max_bids_per_team,
        r.status,
        r.end_time,
        r.season_id
      FROM rounds r
      WHERE r.id = ${round_id}
    `;

    if (roundResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Round not found' },
        { status: 404 }
      );
    }

    const round = roundResult[0];

    // Get team's season data to check budget
    const teamSeasonId = `${teamId}_${round.season_id}`;
    const teamSeasonDoc = await adminDb.collection('team_seasons').doc(teamSeasonId).get();
    
    if (!teamSeasonDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Team not registered for this season' },
        { status: 404 }
      );
    }
    
    const teamSeasonData = teamSeasonDoc.data();
    const teamBalance = teamSeasonData?.budget || 0;

    // Check if team has sufficient balance
    if (amount > teamBalance) {
      return NextResponse.json(
        { success: false, error: 'Insufficient team balance' },
        { status: 400 }
      );
    }

    // Check if round is active
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

    // Verify player exists and is available for this position
    const playerResult = await sql`
      SELECT 
        id,
        name,
        position,
        is_auction_eligible,
        is_sold,
        team_id
      FROM footballplayers 
      WHERE id = ${player_id}
    `;

    if (playerResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }

    const player = playerResult[0];

    // Check if player is available for auction
    if (!player.is_auction_eligible) {
      return NextResponse.json(
        { success: false, error: 'Player is not eligible for auction' },
        { status: 400 }
      );
    }

    if (player.is_sold) {
      return NextResponse.json(
        { success: false, error: 'Player is already sold' },
        { status: 400 }
      );
    }

    if (player.team_id && player.team_id !== '') {
      return NextResponse.json(
        { success: false, error: 'Player is already assigned to a team' },
        { status: 400 }
      );
    }

    if (player.position !== round.position) {
      return NextResponse.json(
        { success: false, error: 'Player position does not match round position' },
        { status: 400 }
      );
    }

    // Check if team already has a bid for this player in this round
    const existingBidResult = await sql`
      SELECT id FROM bids 
      WHERE team_id = ${teamId}
      AND player_id = ${player_id}
      AND round_id = ${round_id}
      AND status = 'active'
    `;

    if (existingBidResult.length > 0) {
      return NextResponse.json(
        { success: false, error: 'You already have a bid for this player in this round' },
        { status: 400 }
      );
    }

    // Check number of active bids for this round
    const bidCountResult = await sql`
      SELECT COUNT(*) as bid_count
      FROM bids 
      WHERE team_id = ${teamId}
      AND round_id = ${round_id}
      AND status = 'active'
    `;

    const bidCount = parseInt(bidCountResult[0]?.bid_count || '0');

    if (bidCount >= round.max_bids_per_team) {
      return NextResponse.json(
        { success: false, error: `Maximum number of bids (${round.max_bids_per_team}) reached for this round` },
        { status: 400 }
      );
    }

    // Encrypt sensitive bid data for blind bidding
    const encryptedBidData = encryptBidData({
      player_id: player_id,
      amount: amount
    });

    // Create the bid with encrypted data
    const bidResult = await sql`
      INSERT INTO bids (
        team_id,
        player_id,
        round_id,
        amount,
        encrypted_bid_data,
        status,
        created_at
      ) VALUES (
        ${teamId},
        ${player_id},
        ${round_id},
        ${amount},
        ${encryptedBidData},
        'active',
        NOW()
      )
      RETURNING id, team_id, round_id, status, created_at
    `;

    const newBid = bidResult[0];

    return NextResponse.json({
      success: true,
      message: 'Bid placed successfully',
      bid: newBid,
    });
  } catch (error) {
    console.error('Error placing bid:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
