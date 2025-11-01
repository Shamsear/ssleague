import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getAuthToken } from '@/lib/auth/token-helper';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * POST /api/admin/bulk-rounds
 * Create a new bulk bidding round and auto-add ALL eligible players
 * Committee admin only
 */
export async function POST(request: NextRequest) {
  try {
    const token = await getAuthToken(request);

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

    // Check if user is committee admin
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    if (userData?.role !== 'admin' && userData?.role !== 'committee_admin') {
      return NextResponse.json(
        { success: false, error: 'Access denied. Committee admin only.' },
        { status: 403 }
      );
    }

    // Get request body
    const { season_id, base_price = 10, duration_seconds = 300 } = await request.json();

    if (!season_id) {
      return NextResponse.json(
        { success: false, error: 'season_id is required' },
        { status: 400 }
      );
    }

    console.log('🔄 Creating bulk round:', { season_id, base_price, duration_seconds });

    // Get next round number for this season
    const existingRounds = await sql`
      SELECT MAX(round_number) as max_round
      FROM rounds
      WHERE season_id = ${season_id}
      AND round_type = 'bulk'
    `;
    
    const nextRoundNumber = (existingRounds[0]?.max_round || 0) + 1;

    // Create the bulk round
    const roundResult = await sql`
    INSERT INTO rounds (
        season_id,
        round_number,
        round_type,
        base_price,
        status,
        duration_seconds,
        created_at
      ) VALUES (
        ${season_id},
        ${nextRoundNumber},
        'bulk',
        ${base_price},
        'draft',
        ${duration_seconds},
        NOW()
      )
      RETURNING id, round_number
    `;

    const roundId = roundResult[0].id;
    const roundNumber = roundResult[0].round_number;

    console.log(`✅ Created bulk round ${roundNumber} with ID: ${roundId}`);

    // Get ALL eligible players (not sold, auction eligible)
    console.time('⚡ Fetch eligible players');
    const eligiblePlayers = await sql`
      SELECT 
        id as player_id,
        name,
        position,
        position_group,
        overall_rating
      FROM footballplayers
      WHERE season_id = ${season_id}
      AND is_auction_eligible = true
      AND is_sold = false
      ORDER BY overall_rating DESC, name ASC
    `;
    console.timeEnd('⚡ Fetch eligible players');

    console.log(`📊 Found ${eligiblePlayers.length} eligible players`);

    if (eligiblePlayers.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No eligible players found for this season. Make sure players are added and marked as auction eligible.' 
        },
        { status: 400 }
      );
    }

    // Insert all players into round_players table
    console.time('⚡ Insert players into round');
    
    // Build bulk insert values
    const playerValues = eligiblePlayers.map((player: any) => 
      `(${roundId}, '${player.player_id}', '${player.name.replace(/'/g, "''")}', '${player.position || ''}', '${player.position_group || ''}', ${base_price}, 'pending')`
    ).join(',');

    await sql.unsafe(`
      INSERT INTO round_players (
        round_id, 
        player_id, 
        player_name, 
        position, 
        position_group, 
        base_price, 
        status
      ) VALUES ${playerValues}
    `);
    
    console.timeEnd('⚡ Insert players into round');

    console.log(`✅ Added ${eligiblePlayers.length} players to bulk round ${roundNumber}`);

    // Return success
    return NextResponse.json({
      success: true,
      data: {
        round_id: roundId,
        round_number: roundNumber,
        season_id,
        base_price,
        duration_seconds,
        player_count: eligiblePlayers.length,
        status: 'draft',
        message: `Bulk round ${roundNumber} created successfully with ${eligiblePlayers.length} players`,
      },
    });

  } catch (error: any) {
    console.error('❌ Error creating bulk round:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/bulk-rounds
 * List all bulk rounds for a season
 * Committee admin only
 */
export async function GET(request: NextRequest) {
  try {
    const token = await getAuthToken(request);

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

    // Check if user is committee admin
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    if (userData?.role !== 'admin' && userData?.role !== 'committee_admin') {
      return NextResponse.json(
        { success: false, error: 'Access denied. Committee admin only.' },
        { status: 403 }
      );
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('season_id');
    const status = searchParams.get('status');

    if (!seasonId) {
      return NextResponse.json(
        { success: false, error: 'season_id is required' },
        { status: 400 }
      );
    }

    // Build query
    let query = sql`
      SELECT 
        ar.id,
        ar.season_id,
        ar.round_number,
        ar.status,
        ar.base_price,
        ar.duration_seconds,
        ar.start_time,
        ar.end_time,
        ar.created_at,
        COUNT(rp.id) as player_count,
        COUNT(rp.id) FILTER (WHERE rp.status = 'sold') as sold_count
      FROM rounds r
      LEFT JOIN round_players rp ON ar.id = rp.round_id
      WHERE ar.season_id = ${seasonId}
      AND ar.round_type = 'bulk'
    `;

    // Add status filter if provided
    if (status && status !== 'all') {
      query = sql`${query} AND ar.status = ${status}`;
    }

    query = sql`
      ${query}
      GROUP BY ar.id
      ORDER BY ar.round_number DESC
    `;

    const rounds = await query;

    return NextResponse.json({
      success: true,
      data: rounds,
    });

  } catch (error: any) {
    console.error('❌ Error fetching bulk rounds:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
