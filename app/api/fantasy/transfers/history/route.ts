import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * GET /api/fantasy/transfers/history?team_id=xxx&window_id=xxx
 * Get transfer history for a team
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const team_id = searchParams.get('team_id');
    const window_id = searchParams.get('window_id');

    if (!team_id) {
      return NextResponse.json(
        { error: 'Missing team_id parameter' },
        { status: 400 }
      );
    }

    let transfers;

    if (window_id) {
      // Get transfers for specific window
      transfers = await fantasySql`
        SELECT * FROM fantasy_transfers
        WHERE team_id = ${team_id}
          AND window_id = ${window_id}
        ORDER BY transferred_at DESC
      `;
    } else {
      // Get all transfers for team
      transfers = await fantasySql`
        SELECT * FROM fantasy_transfers
        WHERE team_id = ${team_id}
        ORDER BY transferred_at DESC
      `;
    }

    return NextResponse.json({
      success: true,
      transfers: transfers.map(t => ({
        transfer_id: t.transfer_id,
        window_id: t.window_id,
        player_out: t.player_out_name ? {
          id: t.player_out_id,
          name: t.player_out_name,
        } : null,
        player_in: {
          id: t.player_in_id,
          name: t.player_in_name,
        },
        transfer_cost: Number(t.transfer_cost),
        points_deducted: Number(t.points_deducted),
        is_free_transfer: t.is_free_transfer,
        transferred_at: t.transferred_at,
      })),
    });
  } catch (error) {
    console.error('Error fetching transfer history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transfer history' },
      { status: 500 }
    );
  }
}
