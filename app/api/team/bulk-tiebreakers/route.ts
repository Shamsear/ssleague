import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { cookies } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * GET /api/team/bulk-tiebreakers
 * List all tiebreakers the team is participating in
 * Team users only
 */
export async function GET(request: NextRequest) {
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

    console.log(`📋 Team ${userId} listing their tiebreakers`);

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'active', 'completed', 'pending'
    const seasonId = searchParams.get('seasonId');

    // Build query
    let query = `
      SELECT 
        bt.id,
        bt.round_id,
        bt.player_name,
        bt.player_team,
        bt.player_position,
        bt.status,
        bt.tie_amount,
        bt.tied_team_count,
        bt.current_highest_bid,
        bt.current_highest_team_id,
        bt.start_time,
        bt.last_activity_time,
        bt.max_end_time,
        bt.created_at,
        ar.round_name,
        ar.season_id,
        btt.status as my_status,
        btt.current_bid as my_current_bid,
        btt.joined_at as my_joined_at,
        btt.withdrawn_at as my_withdrawn_at
      FROM bulk_tiebreakers bt
      INNER JOIN bulk_tiebreaker_teams btt 
        ON bt.id = btt.tiebreaker_id 
        AND btt.team_id = $1
      LEFT JOIN rounds ar ON bt.round_id = ar.id
      WHERE 1=1
    `;

    const params: any[] = [userId];
    let paramIndex = 2;

    if (status) {
      query += ` AND bt.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (seasonId) {
      query += ` AND ar.season_id = $${paramIndex}`;
      params.push(seasonId);
      paramIndex++;
    }

    query += ` ORDER BY bt.created_at DESC`;

    const tiebreakers = await sql(query, params);

    // Enrich data with additional info
    const enrichedTiebreakers = tiebreakers.map((tb: any) => {
      const youAreHighest = tb.current_highest_team_id === userId;
      const canBid = tb.status === 'active' && tb.my_status === 'active';
      const canWithdraw = tb.status === 'active' 
        && tb.my_status === 'active' 
        && !youAreHighest;

      // Time remaining calculation
      let timeRemaining = null;
      if (tb.max_end_time) {
        const now = new Date();
        const maxEnd = new Date(tb.max_end_time);
        const diffMs = maxEnd.getTime() - now.getTime();
        if (diffMs > 0) {
          const hours = Math.floor(diffMs / (1000 * 60 * 60));
          const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
          timeRemaining = `${hours}h ${minutes}m`;
        } else {
          timeRemaining = 'EXPIRED';
        }
      }

      return {
        id: tb.id,
        round_id: tb.round_id,
        round_name: tb.round_name,
        season_id: tb.season_id,
        player_name: tb.player_name,
        player_team: tb.player_team,
        player_position: tb.player_position,
        status: tb.status,
        tie_amount: tb.tie_amount,
        tied_team_count: tb.tied_team_count,
        current_highest_bid: tb.current_highest_bid,
        current_highest_team_id: tb.current_highest_team_id,
        start_time: tb.start_time,
        last_activity_time: tb.last_activity_time,
        max_end_time: tb.max_end_time,
        time_remaining: timeRemaining,
        created_at: tb.created_at,
        my_status: {
          status: tb.my_status,
          current_bid: tb.my_current_bid,
          you_are_highest: youAreHighest,
          can_bid: canBid,
          can_withdraw: canWithdraw,
          joined_at: tb.my_joined_at,
          withdrawn_at: tb.my_withdrawn_at,
        },
      };
    });

    // Group by status for easier frontend consumption
    const grouped = {
      active: enrichedTiebreakers.filter((tb: any) => tb.status === 'active'),
      completed: enrichedTiebreakers.filter((tb: any) => tb.status === 'completed'),
      pending: enrichedTiebreakers.filter((tb: any) => tb.status === 'pending'),
      cancelled: enrichedTiebreakers.filter((tb: any) => tb.status === 'cancelled'),
    };

    return NextResponse.json({
      success: true,
      data: {
        all: enrichedTiebreakers,
        grouped,
        count: {
          total: enrichedTiebreakers.length,
          active: grouped.active.length,
          completed: grouped.completed.length,
          pending: grouped.pending.length,
          cancelled: grouped.cancelled.length,
        },
      },
    });

  } catch (error: any) {
    console.error('❌ Error listing tiebreakers:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
