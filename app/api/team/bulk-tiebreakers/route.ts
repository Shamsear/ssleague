import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '@/lib/auth-helper';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * GET /api/team/bulk-tiebreakers
 * List all tiebreakers the team is participating in
 * Team users only
 */
export async function GET(request: NextRequest) {
  try {
    // ✅ ZERO FIREBASE READS - Uses JWT claims only
    const auth = await verifyAuth(['team'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = auth.userId!;

    console.log(`📋 Team ${userId} listing their tiebreakers`);

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const filterStatus = searchParams.get('status'); // 'active', 'completed', 'pending'
    const seasonId = searchParams.get('seasonId');

    // Query tiebreakers table (used for both regular and bulk rounds)
    // Join with team_tiebreakers to find which ones involve this team
    // Extract firebase_uid from composite ID in team_tiebreakers
    const tiebreakerRows = await sql`
      SELECT 
        t.id,
        t.season_id,
        t.player_id,
        t.player_name,
        t.original_amount,
        t.tied_teams,
        t.status,
        t.winning_team_id,
        t.winning_amount,
        t.created_at,
        t.resolved_at,
        tt.id as team_tiebreaker_id,
        tt.team_name,
        tt.submitted,
        tt.new_bid_amount,
        tt.submitted_at,
        fp.position,
        fp.team_name as player_team,
        fp.overall_rating
      FROM tiebreakers t
      INNER JOIN team_tiebreakers tt ON t.id = tt.tiebreaker_id
      LEFT JOIN footballplayers fp ON t.player_id = fp.id
      WHERE tt.id LIKE ${userId + '_%'}
      ${filterStatus ? sql`AND t.status = ${filterStatus}` : sql``}
      ${seasonId ? sql`AND t.season_id = ${seasonId}` : sql``}
      ORDER BY t.created_at DESC
    `;

    const tiebreakers = tiebreakerRows as any[];

    // Enrich data with additional info
    const enrichedTiebreakers = tiebreakers.map((tb: any) => {
      // Parse tied_teams JSONB to get team count
      const tiedTeams = tb.tied_teams || [];
      const youAreWinner = tb.winning_team_id && tb.winning_team_id.includes(userId);
      const canSubmit = tb.status === 'active' && !tb.submitted;

      return {
        id: tb.id,
        season_id: tb.season_id,
        player: {
          id: tb.player_id,
          name: tb.player_name,
          position: tb.position,
          team: tb.player_team,
          overall_rating: tb.overall_rating,
        },
        original_amount: tb.original_amount,
        status: tb.status,
        tied_teams_count: Array.isArray(tiedTeams) ? tiedTeams.length : 0,
        winning_team_id: tb.winning_team_id,
        winning_amount: tb.winning_amount,
        created_at: tb.created_at,
        resolved_at: tb.resolved_at,
        my_bid: {
          team_name: tb.team_name,
          submitted: tb.submitted,
          new_bid_amount: tb.new_bid_amount,
          submitted_at: tb.submitted_at,
          you_are_winner: youAreWinner,
          can_submit: canSubmit,
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
