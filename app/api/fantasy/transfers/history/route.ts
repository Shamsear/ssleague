import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * GET /api/fantasy/transfers/history?user_id=xxx
 * Get transfer history for user's team
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get('user_id');

    if (!user_id) {
      return NextResponse.json(
        { error: 'Missing user_id parameter' },
        { status: 400 }
      );
    }

    // Get user's fantasy team
    const fantasyTeams = await fantasySql`
      SELECT * FROM fantasy_teams
      WHERE owner_uid = ${user_id} AND is_enabled = true
      LIMIT 1
    `;

    if (fantasyTeams.length === 0) {
      return NextResponse.json(
        { error: 'No fantasy team found' },
        { status: 404 }
      );
    }

    const team = fantasyTeams[0];
    const teamId = team.team_id;
    const leagueId = team.league_id;

    // Get league settings for max transfers
    const leagues = await fantasySql`
      SELECT * FROM fantasy_leagues
      WHERE league_id = ${leagueId}
      LIMIT 1
    `;

    const maxTransfers = Number(leagues[0]?.max_transfers_per_window || 2);

    // Get current active window
    const activeWindows = await fantasySql`
      SELECT * FROM transfer_windows
      WHERE league_id = ${leagueId}
        AND is_active = true
      LIMIT 1
    `;

    const currentWindow = activeWindows[0] || null;

    // Count transfers in current window
    let transfersUsed = 0;
    if (currentWindow) {
      const count = await fantasySql`
        SELECT COUNT(*) as count
        FROM fantasy_transfers
        WHERE team_id = ${teamId}
          AND window_id = ${currentWindow.window_id}
      `;
      transfersUsed = Number(count[0]?.count || 0);
    }

    // Get all transfer history
    const transfers = await fantasySql`
      SELECT 
        t.*,
        w.window_name,
        w.opens_at,
        w.closes_at
      FROM fantasy_transfers t
      LEFT JOIN transfer_windows w ON t.window_id = w.window_id
      WHERE t.team_id = ${teamId}
      ORDER BY t.transferred_at DESC
      LIMIT 50
    `;

    // Format transfers
    const formattedTransfers = transfers.map((t: any) => ({
      _id: t.transfer_id,
      player_out: {
        player_name: t.player_out_name,
        position: '',
        team: '',
        draft_price: 0,
      },
      player_in: {
        player_name: t.player_in_name,
        position: '',
        team: '',
        draft_price: 0,
      },
      timestamp: t.transferred_at,
      points_deducted: Number(t.points_deducted),
      window_name: t.window_name,
    }));

    return NextResponse.json({
      transfers: formattedTransfers,
      transfers_used: transfersUsed,
      max_transfers: maxTransfers,
      current_window: currentWindow ? {
        window_name: currentWindow.window_name,
        opens_at: currentWindow.opens_at,
        closes_at: currentWindow.closes_at,
        is_active: currentWindow.is_active,
      } : null,
    });
  } catch (error) {
    console.error('Error fetching transfer history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transfer history' },
      { status: 500 }
    );
  }
}
