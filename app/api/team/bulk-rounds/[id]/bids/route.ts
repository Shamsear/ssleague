import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { cookies } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { getAuctionSettings } from '@/lib/auction-settings';
import { broadcastWebSocket } from '@/lib/websocket/broadcast';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * POST /api/team/bulk-rounds/:id/bids
 * Submit multiple bids for players in bulk round
 * Team users only
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const firebaseUid = decodedToken.uid;

    // Check if user is a team
    const userDoc = await adminDb.collection('users').doc(firebaseUid).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    if (userData?.role !== 'team') {
      return NextResponse.json(
        { success: false, error: 'Access denied. Team users only.' },
        { status: 403 }
      );
    }

    const { id: roundId } = await params;
    const { player_id } = await request.json();

    // Get team_id from teams table using firebase_uid
    const teamResult = await sql`
      SELECT id FROM teams
      WHERE firebase_uid = ${firebaseUid}
    `;

    if (teamResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Team not found. Please ensure your team is registered.' },
        { status: 404 }
      );
    }

    const teamId = teamResult[0].id;

    // Validate input
    if (!player_id) {
      return NextResponse.json(
        { success: false, error: 'player_id is required' },
        { status: 400 }
      );
    }

    console.log(`🎯 Team ${teamId} (firebase: ${firebaseUid}) bidding on player ${player_id} in round ${roundId}`);

    // Get round details
    const roundCheck = await sql`
      SELECT id, status, base_price, season_id, round_number
      FROM rounds
      WHERE id = ${roundId}
      AND round_type = 'bulk'
    `;

    if (roundCheck.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Bulk round not found' },
        { status: 404 }
      );
    }

    const round = roundCheck[0];

    if (round.status !== 'active') {
      return NextResponse.json(
        { success: false, error: `Round is not active. Current status: ${round.status}` },
        { status: 400 }
      );
    }

    // Get auction settings for the season
    let auctionSettings;
    try {
      auctionSettings = await getAuctionSettings(round.season_id);
    } catch (error: any) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    const MAX_SQUAD_SIZE = auctionSettings.max_squad_size;

    // VALIDATION 1: Get team's current squad count from teams table
    console.time('⚡ Check squad count');
    const teamData = await sql`
      SELECT football_players_count
      FROM teams
      WHERE id = ${teamId}
      AND season_id = ${round.season_id}
    `;
    console.timeEnd('⚡ Check squad count');

    if (teamData.length === 0) {
      console.error(`⚠️ Team not found: teamId=${teamId}, season_id=${round.season_id}`);
      return NextResponse.json(
        { success: false, error: 'Team not found in this season. Please ensure your team is registered.' },
        { status: 404 }
      );
    }

    const currentSquadSize = parseInt(teamData[0].football_players_count) || 0;
    
    // Count existing bids
    const existingBidsCount = await sql`
      SELECT COUNT(*) as count
      FROM round_bids
      WHERE round_id = ${roundId}
      AND team_id = ${teamId}
    `;
    
    const currentBidsCount = parseInt(existingBidsCount[0].count) || 0;
    const availableSlots = MAX_SQUAD_SIZE - currentSquadSize - currentBidsCount;

    console.log(`📊 Current squad: ${currentSquadSize}/${MAX_SQUAD_SIZE}, Current bids: ${currentBidsCount}, Available slots: ${availableSlots}`);

    if (availableSlots <= 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `No available squad slots. Current squad: ${currentSquadSize}/${MAX_SQUAD_SIZE}, Pending bids: ${currentBidsCount}` 
        },
        { status: 400 }
      );
    }

    // VALIDATION 2: Check team balance
    const totalCost = round.base_price;
    
    // Get balance from Neon teams table
    const balanceData = await sql`
      SELECT football_budget
      FROM teams
      WHERE id = ${teamId}
      AND season_id = ${round.season_id}
    `;
    
    let balance = 1000; // Default balance if not found
    if (balanceData.length > 0) {
      balance = parseInt(balanceData[0].football_budget) || 1000;
    }
    
    // Calculate total reserved (existing bids + this bid)
    const totalReserved = (currentBidsCount * round.base_price) + totalCost;

    console.log(`💰 Balance: £${balance}, Required for this bid: £${totalCost}, Total reserved: £${totalReserved}`);

    if (balance < totalReserved) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Insufficient balance. Required: £${totalReserved}, Available: £${balance}` 
        },
        { status: 400 }
      );
    }

    // VALIDATION 3: Check if player exists in this round
    const validPlayers = await sql`
      SELECT player_id, player_name, status
      FROM round_players
      WHERE round_id = ${roundId}
      AND player_id = ${player_id}
    `;

    if (validPlayers.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Player not found in this round' 
        },
        { status: 400 }
      );
    }

    // Check if player already sold
    if (validPlayers[0].status === 'sold') {
      return NextResponse.json(
        { 
          success: false, 
          error: `Player ${validPlayers[0].player_name} is already sold` 
        },
        { status: 400 }
      );
    }

    // VALIDATION 4: Check if team already bid on this player
    const existingBid = await sql`
      SELECT id
      FROM round_bids
      WHERE round_id = ${roundId}
      AND team_id = ${teamId}
      AND player_id = ${player_id}
    `;

    if (existingBid.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'You have already bid on this player' 
        },
        { status: 400 }
      );
    }

    // ALL VALIDATIONS PASSED - Insert bid
    console.log('✅ All validations passed. Inserting bid...');

    const teamName = userData.teamName || 'Unknown Team';

    await sql`
      INSERT INTO round_bids (
        round_id,
        season_id,
        player_id,
        team_id,
        team_name,
        bid_amount,
        bid_time
      ) VALUES (
        ${roundId},
        ${round.season_id},
        ${player_id},
        ${teamId},
        ${teamName},
        ${round.base_price},
        NOW()
      )
    `;

    console.log(`✅ Successfully placed bid for player ${player_id}`);

    // Get updated bid count for this player
    const bidCountResult = await sql`
      SELECT COUNT(*) as count
      FROM round_bids
      WHERE round_id = ${roundId}
      AND player_id = ${player_id}
    `;
    const bidCount = parseInt(bidCountResult[0].count) || 0;

    // ⚡ Broadcast to WebSocket - Committee sees this INSTANTLY!
    await broadcastWebSocket(`round:${roundId}`, {
      type: 'bid_added',
      data: {
        team_id: teamId,
        team_name: teamName,
        player_id,
        bid_amount: round.base_price,
        bid_count: bidCount,
      },
    });

    // NOTE: Balance is NOT deducted yet - only reserved
    // Money will be deducted after round finalization

    return NextResponse.json({
      success: true,
      data: {
        round_id: roundId,
        round_number: round.round_number,
        player_id,
        bid_amount: round.base_price,
        total_reserved: totalReserved,
        remaining_balance: balance - totalReserved,
        remaining_slots: availableSlots - 1,
        message: `Bid placed on ${validPlayers[0].player_name} at £${round.base_price}`,
      },
    });

  } catch (error: any) {
    console.error('❌ Error submitting bulk bids:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/team/bulk-rounds/:id/bids
 * Get team's bids for a bulk round
 * Team users only
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const firebaseUid = decodedToken.uid;

    // Check if user is a team
    const userDoc = await adminDb.collection('users').doc(firebaseUid).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    if (userData?.role !== 'team') {
      return NextResponse.json(
        { success: false, error: 'Access denied. Team users only.' },
        { status: 403 }
      );
    }

    const { id: roundId } = await params;

    // Get team_id from teams table using firebase_uid
    const teamResult = await sql`
      SELECT id FROM teams
      WHERE firebase_uid = ${firebaseUid}
    `;

    if (teamResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Team not found.' },
        { status: 404 }
      );
    }

    const teamId = teamResult[0].id;

    // Get team's bids
    const bids = await sql`
      SELECT 
        rb.id,
        rb.player_id,
        rb.bid_amount,
        rb.bid_time,
        rp.player_name,
        rp.position,
        rp.status as player_status
      FROM round_bids rb
      INNER JOIN round_players rp ON rb.player_id = rp.player_id AND rb.round_id = rp.round_id
      WHERE rb.round_id = ${roundId}
      AND rb.team_id = ${teamId}
      ORDER BY rb.bid_time DESC
    `;

    return NextResponse.json({
      success: true,
      data: {
        bids,
        count: bids.length,
      },
    });

  } catch (error: any) {
    console.error('❌ Error fetching team bids:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/team/bulk-rounds/:id/bids
 * Remove a bid from a bulk round
 * Team users only
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const firebaseUid = decodedToken.uid;

    // Check if user is a team
    const userDoc = await adminDb.collection('users').doc(firebaseUid).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    if (userData?.role !== 'team') {
      return NextResponse.json(
        { success: false, error: 'Access denied. Team users only.' },
        { status: 403 }
      );
    }

    const { id: roundId } = await params;
    const { player_id } = await request.json();

    if (!player_id) {
      return NextResponse.json(
        { success: false, error: 'player_id is required' },
        { status: 400 }
      );
    }

    // Get team_id from teams table using firebase_uid
    const teamResult = await sql`
      SELECT id FROM teams
      WHERE firebase_uid = ${firebaseUid}
    `;

    if (teamResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Team not found.' },
        { status: 404 }
      );
    }

    const teamId = teamResult[0].id;

    console.log(`🗑️ Team ${teamId} (firebase: ${firebaseUid}) removing bid for player ${player_id} in round ${roundId}`);

    // Check round status
    const roundCheck = await sql`
      SELECT status
      FROM rounds
      WHERE id = ${roundId}
      AND round_type = 'bulk'
    `;

    if (roundCheck.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Bulk round not found' },
        { status: 404 }
      );
    }

    if (roundCheck[0].status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Cannot remove bids from inactive round' },
        { status: 400 }
      );
    }

    // Delete the bid
    const result = await sql`
      DELETE FROM round_bids
      WHERE round_id = ${roundId}
      AND team_id = ${teamId}
      AND player_id = ${player_id}
      RETURNING id, player_id
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Bid not found' },
        { status: 404 }
      );
    }

    console.log(`✅ Removed bid for player ${player_id}`);

    // Get updated bid count for this player
    const bidCountResult = await sql`
      SELECT COUNT(*) as count
      FROM round_bids
      WHERE round_id = ${roundId}
      AND player_id = ${player_id}
    `;
    const bidCount = parseInt(bidCountResult[0].count) || 0;

    // ⚡ Broadcast to WebSocket - Committee sees this INSTANTLY!
    await broadcastWebSocket(`round:${roundId}`, {
      type: 'bid_removed',
      data: {
        team_id: teamId,
        player_id,
        bid_count: bidCount,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        message: 'Bid removed successfully',
        player_id,
      },
    });

  } catch (error: any) {
    console.error('❌ Error removing bid:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
