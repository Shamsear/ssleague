import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * GET /api/fantasy/players/[playerId]/points
 * Get detailed points breakdown for a player
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { playerId: string } }
) {
  try {
    const playerId = params.playerId;

    if (!playerId) {
      return NextResponse.json(
        { error: 'Missing player ID' },
        { status: 400 }
      );
    }

    // Get player basic info from fantasy_squad
    const playerInfo = await fantasySql`
      SELECT 
        fs.real_player_id,
        fs.player_name,
        fs.position,
        fs.real_team_name,
        fs.purchase_price,
        fs.current_value,
        fs.total_points,
        fs.is_captain,
        fs.is_vice_captain,
        ft.team_name as fantasy_team_name,
        ft.owner_name
      FROM fantasy_squad fs
      JOIN fantasy_teams ft ON fs.team_id = ft.team_id
      WHERE fs.real_player_id = ${playerId}
      LIMIT 1
    `;

    if (playerInfo.length === 0) {
      return NextResponse.json(
        { error: 'Player not found in any fantasy squad' },
        { status: 404 }
      );
    }

    const player = playerInfo[0];

    // Get detailed points breakdown by match
    const pointsBreakdown = await fantasySql`
      SELECT 
        fixture_id,
        round_number,
        goals_scored,
        goals_conceded,
        clean_sheet,
        motm,
        base_points,
        bonus_points,
        total_points,
        is_captain,
        points_multiplier,
        recorded_at
      FROM fantasy_player_points
      WHERE real_player_id = ${playerId}
      ORDER BY round_number DESC, recorded_at DESC
    `;

    // Calculate statistics
    const stats = {
      total_matches: pointsBreakdown.length,
      total_goals: pointsBreakdown.reduce((sum: number, p: any) => sum + (p.goals_scored || 0), 0),
      total_clean_sheets: pointsBreakdown.filter((p: any) => p.clean_sheet).length,
      total_motm: pointsBreakdown.filter((p: any) => p.motm).length,
      total_base_points: pointsBreakdown.reduce((sum: number, p: any) => sum + (p.base_points || 0), 0),
      total_bonus_points: pointsBreakdown.reduce((sum: number, p: any) => sum + (p.bonus_points || 0), 0),
      average_points: pointsBreakdown.length > 0 
        ? (pointsBreakdown.reduce((sum: number, p: any) => sum + (p.total_points || 0), 0) / pointsBreakdown.length).toFixed(1)
        : 0,
      best_performance: pointsBreakdown.length > 0
        ? Math.max(...pointsBreakdown.map((p: any) => p.total_points || 0))
        : 0,
    };

    return NextResponse.json({
      player: {
        real_player_id: player.real_player_id,
        player_name: player.player_name,
        position: player.position,
        real_team_name: player.real_team_name,
        purchase_price: Number(player.purchase_price),
        current_value: Number(player.current_value),
        total_points: player.total_points,
        is_captain: player.is_captain,
        is_vice_captain: player.is_vice_captain,
        fantasy_team_name: player.fantasy_team_name,
        owner_name: player.owner_name,
      },
      stats,
      matches: pointsBreakdown.map((match: any) => ({
        fixture_id: match.fixture_id,
        round_number: match.round_number,
        goals_scored: match.goals_scored,
        goals_conceded: match.goals_conceded,
        clean_sheet: match.clean_sheet,
        motm: match.motm,
        base_points: match.base_points,
        bonus_points: match.bonus_points,
        total_points: match.total_points,
        is_captain: match.is_captain,
        points_multiplier: match.points_multiplier,
        recorded_at: match.recorded_at,
      })),
    });
  } catch (error) {
    console.error('Error fetching player points:', error);
    return NextResponse.json(
      { error: 'Failed to fetch player points', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
