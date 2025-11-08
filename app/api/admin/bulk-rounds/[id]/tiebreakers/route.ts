import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '@/lib/auth-helper';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * GET /api/admin/bulk-rounds/:id/tiebreakers
 * Get all tiebreakers for a bulk round
 * Committee admin only
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(['admin', 'committee_admin'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: roundId } = await params;

    console.log(`🔍 Fetching tiebreakers for bulk round: ${roundId}`);

    // Get all tiebreakers for this round
    const tiebreakers = await sql`
      SELECT 
        bt.id,
        bt.bulk_round_id,
        bt.season_id,
        bt.player_id,
        bt.player_name,
        bt.player_position as position,
        bt.base_price as original_amount,
        bt.status,
        bt.current_highest_bid,
        bt.current_highest_team_id,
        bt.teams_remaining,
        bt.start_time,
        bt.last_activity_time,
        bt.max_end_time,
        bt.created_at,
        bt.updated_at,
        bt.resolved_at
      FROM bulk_tiebreakers bt
      WHERE bt.bulk_round_id = ${roundId}
      ORDER BY bt.created_at DESC
    `;

    console.log(`✅ Found ${tiebreakers.length} tiebreakers`);

    // Get team information for each tiebreaker
    const tiebreakerIds = tiebreakers.map(t => t.id);
    
    let teamsData: any[] = [];
    if (tiebreakerIds.length > 0) {
      teamsData = await sql`
        SELECT 
          btt.tiebreaker_id,
          btt.team_id,
          btt.team_name,
          btt.status,
          btt.current_bid,
          btt.joined_at,
          btt.withdrawn_at
        FROM bulk_tiebreaker_teams btt
        WHERE btt.tiebreaker_id = ANY(${tiebreakerIds})
        ORDER BY btt.current_bid DESC NULLS LAST
      `;
    }

    // Group teams by tiebreaker
    const teamsByTiebreaker = teamsData.reduce((acc, team) => {
      if (!acc[team.tiebreaker_id]) {
        acc[team.tiebreaker_id] = [];
      }
      acc[team.tiebreaker_id].push({
        team_id: team.team_id,
        team_name: team.team_name,
        status: team.status,
        bid_amount: team.current_bid,
        submitted_at: team.joined_at,
        withdrawn_at: team.withdrawn_at,
      });
      return acc;
    }, {} as Record<string, any[]>);

    // Format response
    const formattedTiebreakers = tiebreakers.map(tb => {
      const teams = teamsByTiebreaker[tb.id] || [];
      const activeTeams = teams.filter(t => t.status === 'active');
      const teamsWithBids = teams.filter(t => t.bid_amount > 0);

      return {
        id: tb.id,
        round_id: tb.bulk_round_id,
        player_id: tb.player_id,
        player_name: tb.player_name,
        position: tb.position,
        original_amount: tb.original_amount,
        status: tb.status,
        current_highest_bid: tb.current_highest_bid,
        current_highest_team_id: tb.current_highest_team_id,
        teams_count: teams.length,
        active_teams_count: activeTeams.length,
        submitted_count: teamsWithBids.length,
        teams_remaining: tb.teams_remaining,
        created_at: tb.created_at,
        updated_at: tb.updated_at,
        resolved_at: tb.resolved_at,
        start_time: tb.start_time,
        last_activity_time: tb.last_activity_time,
        max_end_time: tb.max_end_time,
        teams: teams,
      };
    });

    return NextResponse.json({
      success: true,
      data: formattedTiebreakers,
    });

  } catch (error: any) {
    console.error('❌ Error fetching tiebreakers:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
