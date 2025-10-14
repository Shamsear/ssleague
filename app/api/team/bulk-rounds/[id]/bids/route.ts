import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { cookies } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

const MAX_SQUAD_SIZE = 25;

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

    const userId = decodedToken.uid;

    // Check if user is a team
    const userDoc = await adminDb.collection('users').doc(userId).get();
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
    const { player_ids } = await request.json();

    // Validate input
    if (!player_ids || !Array.isArray(player_ids) || player_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'player_ids array is required and must not be empty' },
        { status: 400 }
      );
    }

    console.log(`🎯 Team ${userId} bidding on ${player_ids.length} players in round ${roundId}`);

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

    // VALIDATION 1: Get team's current squad count
    console.time('⚡ Check squad count');
    const squadCount = await sql`
      SELECT COUNT(*) as count
      FROM footballplayers
      WHERE team_id = ${userId}
      AND season_id = ${round.season_id}
    `;
    console.timeEnd('⚡ Check squad count');

    const currentSquadSize = parseInt(squadCount[0].count);
    const availableSlots = MAX_SQUAD_SIZE - currentSquadSize;

    console.log(`📊 Current squad: ${currentSquadSize}/${MAX_SQUAD_SIZE}, Available slots: ${availableSlots}`);

    if (player_ids.length > availableSlots) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Cannot bid on ${player_ids.length} players. You only have ${availableSlots} available slots (current squad: ${currentSquadSize}/${MAX_SQUAD_SIZE})` 
        },
        { status: 400 }
      );
    }

    // VALIDATION 2: Check team balance
    const totalCost = player_ids.length * round.base_price;
    
    // Get balance from Firebase (team_seasons collection)
    const teamSeasonId = `${userId}_${round.season_id}`;
    const teamSeasonDoc = await adminDb.collection('team_seasons').doc(teamSeasonId).get();
    
    let balance = 1000; // Default balance if not found
    if (teamSeasonDoc.exists) {
      balance = teamSeasonDoc.data()?.balance || 1000;
    }

    console.log(`💰 Balance: £${balance}, Required: £${totalCost}`);

    if (balance < totalCost) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Insufficient balance. Required: £${totalCost}, Available: £${balance}` 
        },
        { status: 400 }
      );
    }

    // VALIDATION 3: Check if players exist in this round
    console.time('⚡ Validate players');
    const playerIdsString = player_ids.map((id: string) => `'${id}'`).join(',');
    const validPlayers = await sql.unsafe(`
      SELECT player_id, player_name, status
      FROM round_players
      WHERE round_id = ${roundId}
      AND player_id IN (${playerIdsString})
    `) as any;
    console.timeEnd('⚡ Validate players');

    if (validPlayers.length !== player_ids.length) {
      const foundIds = validPlayers.map((p: any) => p.player_id);
      const invalidIds = player_ids.filter((id: string) => !foundIds.includes(id));
      return NextResponse.json(
        { 
          success: false, 
          error: `Invalid player IDs: ${invalidIds.join(', ')}` 
        },
        { status: 400 }
      );
    }

    // Check if any players already sold
    const soldPlayers = validPlayers.filter((p: any) => p.status === 'sold');
    if (soldPlayers.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Some players are already sold: ${soldPlayers.map((p: any) => p.player_name).join(', ')}` 
        },
        { status: 400 }
      );
    }

    // VALIDATION 4: Check if team already bid on these players
    const existingBids = await sql.unsafe(`
      SELECT player_id
      FROM round_bids
      WHERE round_id = ${roundId}
      AND team_id = '${userId}'
      AND player_id IN (${playerIdsString})
    `) as any;

    if (existingBids.length > 0) {
      const alreadyBid = existingBids.map((b: any) => b.player_id);
      return NextResponse.json(
        { 
          success: false, 
          error: `You have already bid on some of these players: ${alreadyBid.join(', ')}` 
        },
        { status: 400 }
      );
    }

    // ALL VALIDATIONS PASSED - Insert bids
    console.log('✅ All validations passed. Inserting bids...');
    console.time('⚡ Insert bids');

    const teamName = userData.teamName || 'Unknown Team';
    const timestamp = new Date().toISOString();

    // Build bulk insert
    const bidValues = player_ids.map((playerId: string) => 
      `(${roundId}, '${playerId}', '${userId}', '${teamName}', ${round.base_price}, '${timestamp}')`
    ).join(',');

    await sql.unsafe(`
      INSERT INTO round_bids (
        round_id,
        player_id,
        team_id,
        team_name,
        bid_amount,
        bid_time
      ) VALUES ${bidValues}
    `);

    console.timeEnd('⚡ Insert bids');

    console.log(`✅ Successfully placed ${player_ids.length} bids for team ${userId}`);

    // NOTE: Balance is NOT deducted yet - only reserved
    // Money will be deducted after round finalization:
    // - For single bidders: Deduct £10
    // - For conflicts: Deduct final tiebreaker bid amount

    return NextResponse.json({
      success: true,
      data: {
        round_id: roundId,
        round_number: round.round_number,
        bids_placed: player_ids.length,
        total_reserved: totalCost,
        remaining_balance: balance, // Not actually deducted yet
        remaining_slots: availableSlots - player_ids.length,
        message: `Successfully bid on ${player_ids.length} players. Total reserved: £${totalCost}. Your bids will be processed when the round ends.`,
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

    const userId = decodedToken.uid;

    // Check if user is a team
    const userDoc = await adminDb.collection('users').doc(userId).get();
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
      AND rb.team_id = ${userId}
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
