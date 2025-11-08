import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.NEON_AUCTION_DB_URL!);

/**
 * GET /api/bulk-rounds/:id
 * Get bulk round details with bulk tiebreakers data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: roundId } = await params;

    // Fetch round details
    const rounds = await sql`
      SELECT * FROM rounds WHERE id = ${roundId} LIMIT 1
    `;

    if (rounds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Round not found' },
        { status: 404 }
      );
    }

    const round = rounds[0];

    // Fetch players with bulk tiebreaker info
    const roundPlayers = await sql`
      SELECT 
        rp.*,
        COUNT(rb.id) as bid_count,
        bt.id as tiebreaker_id,
        bt.status as tiebreaker_status,
        bt.created_at as tiebreaker_created_at,
        bt.current_highest_bid,
        bt.current_highest_team_id,
        bt.start_time as tiebreaker_start_time,
        bt.last_activity_time
      FROM round_players rp
      LEFT JOIN round_bids rb ON rp.round_id::text = rb.round_id::text AND rp.player_id = rb.player_id
      LEFT JOIN bulk_tiebreakers bt ON rp.player_id = bt.player_id AND bt.bulk_round_id::text = ${roundId}
      WHERE rp.round_id::text = ${roundId}
      GROUP BY rp.id, bt.id, bt.status, bt.created_at, bt.current_highest_bid, bt.current_highest_team_id, bt.start_time, bt.last_activity_time
      ORDER BY rp.status, rp.player_name
    `;

    // For each player with a bulk tiebreaker, fetch team bids
    for (let i = 0; i < roundPlayers.length; i++) {
      if (roundPlayers[i].tiebreaker_id) {
        const tiebreakerTeams = await sql`
          SELECT 
            btt.team_id,
            btt.team_name,
            btt.current_bid,
            btt.status,
            btt.joined_at,
            btt.withdrawn_at
          FROM bulk_tiebreaker_teams btt
          WHERE btt.tiebreaker_id = ${roundPlayers[i].tiebreaker_id}
          ORDER BY btt.current_bid DESC NULLS LAST, btt.joined_at ASC
        `;

        const submissions = tiebreakerTeams.map(team => ({
          team_id: team.team_id,
          team_name: team.team_name,
          new_bid_amount: team.current_bid || 0,
          submitted: team.withdrawn_at || team.joined_at,
          status: team.status,
        }));

        const activeSubmissions = submissions.filter(s => s.status === 'active');
        const highestSubmission = activeSubmissions[0] || submissions[0];

        roundPlayers[i].tiebreaker = {
          id: roundPlayers[i].tiebreaker_id,
          status: roundPlayers[i].tiebreaker_status,
          created_at: roundPlayers[i].tiebreaker_created_at,
          start_time: roundPlayers[i].tiebreaker_start_time,
          last_activity_time: roundPlayers[i].last_activity_time,
          team_count: tiebreakerTeams.length,
          highest_bid: roundPlayers[i].current_highest_bid || highestSubmission?.new_bid_amount,
          highest_bidder: tiebreakerTeams.find(t => t.team_id === roundPlayers[i].current_highest_team_id)?.team_name || highestSubmission?.team_name,
          submissions,
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...round,
        roundPlayers,
      },
    });
  } catch (error: any) {
    console.error('Error fetching bulk round:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
