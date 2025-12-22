import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * GET /api/fantasy/transfers/all?league_id=xxx&window_id=xxx
 * Get all transfers for a league (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const league_id = searchParams.get('league_id');
    const window_id = searchParams.get('window_id');

    if (!league_id) {
      return NextResponse.json(
        { error: 'Missing league_id parameter' },
        { status: 400 }
      );
    }

    let transfers;

    if (window_id) {
      // Get transfers for specific window
      transfers = await fantasySql`
        SELECT 
          ft.*,
          fteam.team_name,
          fteam.owner_name
        FROM fantasy_transfers ft
        JOIN fantasy_teams fteam ON ft.team_id = fteam.team_id
        WHERE ft.league_id = ${league_id}
          AND ft.window_id = ${window_id}
        ORDER BY ft.transferred_at DESC
      `;
    } else {
      // Get all transfers for league
      transfers = await fantasySql`
        SELECT 
          ft.*,
          fteam.team_name,
          fteam.owner_name
        FROM fantasy_transfers ft
        JOIN fantasy_teams fteam ON ft.team_id = fteam.team_id
        WHERE ft.league_id = ${league_id}
        ORDER BY ft.transferred_at DESC
      `;
    }

    // Get transfer windows for context
    const windows = await fantasySql`
      SELECT window_id, window_name
      FROM transfer_windows
      WHERE league_id = ${league_id}
      ORDER BY opens_at DESC
    `;

    const windowMap = new Map(windows.map(w => [w.window_id, w.window_name]));

    return NextResponse.json({
      success: true,
      transfers: transfers.map(t => ({
        transfer_id: t.transfer_id,
        team_id: t.team_id,
        team_name: t.team_name,
        owner_name: t.owner_name,
        window_id: t.window_id,
        window_name: windowMap.get(t.window_id) || 'Unknown Window',
        player_out: t.player_out_name ? {
          id: t.player_out_id,
          name: t.player_out_name,
        } : null,
        player_in: t.player_in_name ? {
          id: t.player_in_id,
          name: t.player_in_name,
        } : null,
        transfer_cost: Number(t.transfer_cost || 0),
        points_deducted: Number(t.points_deducted || 0),
        is_free_transfer: t.is_free_transfer,
        transferred_at: t.transferred_at,
      })),
      total_count: transfers.length,
    });
  } catch (error) {
    console.error('Error fetching all transfers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transfers', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
