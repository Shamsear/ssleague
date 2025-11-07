import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '@/lib/auth-helper';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * GET /api/team/bulk-tiebreakers/:id
 * Get tiebreaker details and current state
 * Team users only
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: tiebreakerId } = await params;

    console.log(`📊 Team ${userId} viewing tiebreaker ${tiebreakerId}`);

    // Get tiebreaker details (matching actual bulk_tiebreakers schema)
    const tiebreakerData = await sql`
      SELECT 
        bt.id,
        bt.bulk_round_id,
        bt.season_id,
        bt.player_id,
        bt.player_name,
        bt.player_position,
        bt.base_price,
        bt.status,
        bt.current_highest_bid,
        bt.current_highest_team_id,
        bt.teams_remaining,
        bt.created_at,
        bt.updated_at,
        bt.resolved_at
      FROM bulk_tiebreakers bt
      WHERE bt.id = ${tiebreakerId}
    `;

    if (tiebreakerData.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tiebreaker not found' },
        { status: 404 }
      );
    }

    const tiebreaker = tiebreakerData[0];
    
    // Get player details from footballplayers table
    const playerDetails = await sql`
      SELECT 
        id,
        name,
        position,
        team_name as player_team,
        overall_rating
      FROM footballplayers
      WHERE id = ${tiebreaker.player_id}
    `;
    
    const player = playerDetails[0] || {
      name: tiebreaker.player_name,
      position: '',
      player_team: '',
      overall_rating: 0
    };
    
    // Get team_id from teams table using Firebase UID
    const teamResult = await sql`
      SELECT id FROM teams WHERE firebase_uid = ${userId}
    `;
    
    if (teamResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Team not found' },
        { status: 404 }
      );
    }
    
    const teamId = teamResult[0].id;

    // Check if team is participating
    const myTeamData = await sql`
      SELECT 
        status,
        current_bid,
        joined_at,
        withdrawn_at
      FROM bulk_tiebreaker_teams
      WHERE tiebreaker_id = ${tiebreakerId}
      AND team_id = ${teamId}
    `;

    if (myTeamData.length === 0) {
      return NextResponse.json(
        { success: false, error: 'You are not participating in this tiebreaker' },
        { status: 403 }
      );
    }

    const myTeam = myTeamData[0];

    // Get all participating teams (for context)
    const participatingTeams = await sql`
      SELECT 
        team_id,
        team_name,
        status,
        current_bid,
        joined_at,
        withdrawn_at
      FROM bulk_tiebreaker_teams
      WHERE tiebreaker_id = ${tiebreakerId}
      ORDER BY current_bid DESC NULLS LAST, joined_at ASC
    `;

    // Get bid history (last 10 bids)
    const bidHistory = await sql`
      SELECT 
        id,
        team_id,
        team_name,
        bid_amount,
        bid_time
      FROM bulk_tiebreaker_bids
      WHERE tiebreaker_id = ${tiebreakerId}
      ORDER BY bid_time DESC
      LIMIT 10
    `;

    // Calculate statistics
    const activeTeamsCount = participatingTeams.filter(t => t.status === 'active').length;
    const withdrawnTeamsCount = participatingTeams.filter(t => t.status === 'withdrawn').length;
    
    // Use current_highest_bid from tiebreaker or calculate from teams
    const currentHighestBid = tiebreaker.current_highest_bid || Math.max(
      tiebreaker.base_price,
      ...participatingTeams.map(t => t.current_bid || 0)
    );
    
    const highestBidder = participatingTeams.find(t => t.current_bid === currentHighestBid);

    // Determine if user can bid or withdraw
    const canBid = tiebreaker.status === 'active' && myTeam.status === 'active';
    const canWithdraw = tiebreaker.status === 'active' 
      && myTeam.status === 'active' 
      && highestBidder?.team_id !== teamId;

    const youAreHighest = highestBidder?.team_id === teamId;

    return NextResponse.json({
      success: true,
      data: {
        id: tiebreaker.id,
        bulk_round_id: tiebreaker.bulk_round_id,
        player_id: tiebreaker.player_id,
        player_name: player.name || tiebreaker.player_name,
        position: player.position || tiebreaker.player_position || '',
        player_team: player.player_team || '',
        overall_rating: player.overall_rating || 0,
        status: tiebreaker.status,
        season_id: tiebreaker.season_id,
        base_price: tiebreaker.base_price,
        tie_amount: tiebreaker.base_price,
        original_amount: tiebreaker.base_price,
        teams_remaining: tiebreaker.teams_remaining,
        tied_team_count: participatingTeams.length,
        current_highest_bid: currentHighestBid,
        current_highest_team_id: tiebreaker.current_highest_team_id || highestBidder?.team_id,
        created_at: tiebreaker.created_at,
        resolved_at: tiebreaker.resolved_at,
        teams: participatingTeams.map(team => ({
          team_id: team.team_id,
          team_name: team.team_name,
          status: team.status,
          current_bid: team.current_bid,
          is_current_user: team.team_id === teamId,
          team_balance: team.team_id === teamId ? 1000 : null,
        })),
        bid_history: bidHistory.map(bid => ({
          team_id: bid.team_id,
          team_name: bid.team_name,
          amount: bid.bid_amount,
          timestamp: bid.bid_time,
        })),
        my_status: {
          status: myTeam.status,
          current_bid: myTeam.current_bid,
          you_are_highest: youAreHighest,
          can_bid: canBid,
          can_withdraw: canWithdraw,
          joined_at: myTeam.joined_at,
          withdrawn_at: myTeam.withdrawn_at,
        },
        statistics: {
          active_teams: activeTeamsCount,
          withdrawn_teams: withdrawnTeamsCount,
          total_bids: bidHistory.length,
        },
        participating_teams: participatingTeams.map(team => ({
          team_id: team.team_id,
          team_name: team.team_name,
          status: team.status,
          current_bid: team.current_bid,
          is_you: team.team_id === userId,
        })),
        recent_bids: bidHistory.map(bid => ({
          team_id: bid.team_id,
          team_name: bid.team_name,
          bid_amount: bid.bid_amount,
          bid_time: bid.bid_time,
          is_you: bid.team_id === userId,
        })),
      },
    });

  } catch (error: any) {
    console.error('❌ Error fetching tiebreaker details:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
