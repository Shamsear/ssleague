import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

// Use auction database
const sql = neon(process.env.DATABASE_URL || process.env.NEON_AUCTION_DB_URL!);

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

    // Get summary statistics only (much faster than fetching all players)
    const stats = await sql`
      SELECT 
        COUNT(*) as total_players,
        COUNT(*) FILTER (WHERE rp.status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE rp.status = 'sold') as sold_count
      FROM round_players rp
      WHERE rp.round_id = ${roundId}
    `;

    // Get all players in the round with pagination support
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;
    const showAll = searchParams.get('show_all') === 'true';

    // If show_all is false, only show players with bids or tiebreakers
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
      LEFT JOIN round_bids rb ON rp.round_id = rb.round_id AND rp.player_id = rb.player_id
      LEFT JOIN bulk_tiebreakers bt ON rp.player_id = bt.player_id AND bt.bulk_round_id = ${roundId}
      WHERE rp.round_id = ${roundId}
      GROUP BY rp.id, bt.id, bt.status, bt.created_at, bt.current_highest_bid, bt.current_highest_team_id, bt.start_time, bt.last_activity_time
      ${showAll ? sql`` : sql`HAVING COUNT(rb.id) > 0 OR bt.id IS NOT NULL`}
      ORDER BY COUNT(rb.id) DESC, rp.player_name
      LIMIT ${limit} OFFSET ${offset}
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

    const totalPlayers = parseInt(stats[0]?.total_players || '0');
    const totalPages = Math.ceil(totalPlayers / limit);

    return NextResponse.json({
      success: true,
      data: {
        ...round,
        roundPlayers,
        stats: {
          total_players: totalPlayers,
          pending_count: parseInt(stats[0]?.pending_count || '0'),
          sold_count: parseInt(stats[0]?.sold_count || '0'),
        },
        pagination: {
          page,
          limit,
          total: totalPlayers,
          totalPages,
          hasMore: page < totalPages,
        },
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
