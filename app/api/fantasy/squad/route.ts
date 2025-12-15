import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * GET /api/fantasy/squad?user_id=xxx
 * Get current user's fantasy squad with lineup info
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json(
        { error: 'user_id query parameter is required' },
        { status: 400 }
      );
    }

    // Get user's fantasy team
    const teams = await fantasySql`
      SELECT team_id, league_id, team_name
      FROM fantasy_teams
      WHERE owner_uid = ${userId} AND is_enabled = true
      LIMIT 1
    `;

    if (teams.length === 0) {
      return NextResponse.json(
        { error: 'No fantasy team found' },
        { status: 404 }
      );
    }

    const { team_id, league_id } = teams[0];

    // Get squad with lineup info
    const squad = await fantasySql`
      SELECT 
        squad_id as id,
        real_player_id,
        player_name,
        position,
        real_team_name as team,
        COALESCE(is_starting, true) as is_starting,
        COALESCE(is_captain, false) as is_captain,
        COALESCE(is_vice_captain, false) as is_vice_captain,
        total_points,
        current_value,
        acquisition_type,
        acquired_at
      FROM fantasy_squad
      WHERE team_id = ${team_id}
      ORDER BY is_starting DESC NULLS LAST, is_captain DESC NULLS LAST, is_vice_captain DESC NULLS LAST, acquired_at ASC
    `;

    return NextResponse.json({
      squad,
      league_id,
      team_id,
    });
  } catch (error) {
    console.error('Error fetching squad:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch squad',
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
