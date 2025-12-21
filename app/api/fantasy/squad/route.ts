import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * GET /api/fantasy/squad?team_id=xxx
 * Get complete squad data for a fantasy team
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const team_id = searchParams.get('team_id');

    if (!team_id) {
      return NextResponse.json(
        { error: 'Missing team_id parameter' },
        { status: 400 }
      );
    }

    // Get squad with all details
    const squad = await fantasySql`
      SELECT 
        squad_id,
        team_id,
        league_id,
        real_player_id,
        player_name,
        position,
        real_team_name,
        purchase_price,
        current_value,
        total_points,
        is_captain,
        is_vice_captain,
        acquisition_type,
        acquired_at
      FROM fantasy_squad
      WHERE team_id = ${team_id}
      ORDER BY acquired_at DESC
    `;

    return NextResponse.json({
      success: true,
      squad: squad.map(p => ({
        squad_id: p.squad_id,
        real_player_id: p.real_player_id,
        player_name: p.player_name,
        position: p.position || 'Unknown',
        real_team_name: p.real_team_name || 'Unknown',
        purchase_price: Number(p.purchase_price || 0),
        current_value: Number(p.current_value || 0),
        total_points: Number(p.total_points || 0),
        is_captain: p.is_captain || false,
        is_vice_captain: p.is_vice_captain || false,
        acquisition_type: p.acquisition_type,
        acquired_at: p.acquired_at,
      })),
    });
  } catch (error) {
    console.error('Error fetching squad:', error);
    return NextResponse.json(
      { error: 'Failed to fetch squad', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
