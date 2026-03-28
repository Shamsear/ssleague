/**
 * API: Player Analysis
 * GET /api/fantasy/players/[playerId] - Get detailed player analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { 
  getLastNPerformances, 
  calculateFormStatus,
  getFormEmoji,
  getFormLabel,
  getFormColor
} from '@/lib/fantasy/form-tracker';

export async function GET(
  request: NextRequest,
  { params }: { params: { playerId: string } }
) {
  try {
    const playerId = params.playerId;

    if (!playerId) {
      return NextResponse.json(
        { error: 'playerId is required' },
        { status: 400 }
      );
    }

    const sql = neon(process.env.NEON_DATABASE_URL!);

    // Get league_id from query params (required for player lookup)
    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('leagueId');

    if (!leagueId) {
      return NextResponse.json(
        { error: 'leagueId is required' },
        { status: 400 }
      );
    }

    // Get player basic info from fantasy_players
    const playerResult = await sql`
      SELECT 
        real_player_id,
        player_name,
        position,
        real_team_name,
        current_price,
        total_points
      FROM fantasy_players
      WHERE league_id = ${leagueId}
      AND real_player_id = ${playerId}
      LIMIT 1
    `;

    if (playerResult.length === 0) {
      return NextResponse.json(
        { error: 'Player not found' },
        { status: 404 }
      );
    }

    const player = playerResult[0];

    // Calculate ownership percentage
    const totalTeamsResult = await sql`
      SELECT COUNT(*) as count
      FROM fantasy_teams
      WHERE league_id = ${leagueId}
      AND is_enabled = true
    `;
    const totalTeams = Number(totalTeamsResult[0].count);

    const ownedByResult = await sql`
      SELECT COUNT(DISTINCT team_id) as count
      FROM fantasy_squad
      WHERE league_id = ${leagueId}
      AND real_player_id = ${playerId}
    `;
    const ownedBy = Number(ownedByResult[0].count);
    const ownership = totalTeams > 0 ? (ownedBy / totalTeams) * 100 : 0;

    // Get captain count from latest round
    const captainResult = await sql`
      SELECT COUNT(*) as count
      FROM fantasy_lineups
      WHERE league_id = ${leagueId}
      AND real_player_id = ${playerId}
      AND is_captain = true
      ORDER BY round_number DESC
      LIMIT 1
    `;
    const captainCount = captainResult.length > 0 ? Number(captainResult[0].count) : 0;

    // Get last 10 performances for graph
    const performances = await getLastNPerformances(playerId, 10);

    // Calculate form based on last 5
    const last5 = performances.slice(0, 5);
    const formData = calculateFormStatus(last5);

    const playerInfo = {
      player_id: playerId,
      player_name: player.player_name,
      position: player.position || 'Unknown',
      team: player.real_team_name || 'Unknown',
      price: Number(player.current_price),
      ownership: parseFloat(ownership.toFixed(2)),
      captain_count: captainCount,
      total_points: Number(player.total_points)
    };

    return NextResponse.json({
      success: true,
      player: playerInfo,
      form: {
        status: formData.status,
        emoji: getFormEmoji(formData.status),
        label: getFormLabel(formData.status),
        color: getFormColor(formData.status),
        multiplier: formData.multiplier,
        last_5_avg: formData.last_5_avg,
        streak: formData.streak
      },
      performances: performances.map(p => ({
        round_id: p.round_id,
        round_number: p.round_number,
        points: p.points,
        played_at: p.played_at
      }))
    });

  } catch (error: any) {
    console.error('Error fetching player analysis:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch player analysis',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
