import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * POST /api/fantasy/teams/select-supported
 * Select or update the supported real team for passive points
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, supported_team_id, supported_team_name } = body;

    if (!user_id || !supported_team_id || !supported_team_name) {
      return NextResponse.json(
        { error: 'user_id, supported_team_id, and supported_team_name are required' },
        { status: 400 }
      );
    }

    // Find the fantasy team for this user
    const teams = await fantasySql`
      SELECT team_id FROM fantasy_teams
      WHERE owner_uid = ${user_id} AND is_enabled = true
      LIMIT 1
    `;

    if (teams.length === 0) {
      return NextResponse.json(
        { error: 'Fantasy team not found' },
        { status: 404 }
      );
    }

    const teamId = teams[0].team_id;

    // Update the supported team
    await fantasySql`
      UPDATE fantasy_teams
      SET supported_team_id = ${supported_team_id},
          supported_team_name = ${supported_team_name},
          updated_at = CURRENT_TIMESTAMP
      WHERE team_id = ${teamId}
    `;

    console.log(`✅ Fantasy team ${teamId} now supporting ${supported_team_name}`);

    // Get league ID for broadcasting
    const team = await fantasySql`
      SELECT league_id FROM fantasy_teams WHERE team_id = ${teamId} LIMIT 1
    `;
    
    // Broadcast to WebSocket subscribers
    if (team.length > 0 && typeof global.wsBroadcast === 'function') {
      global.wsBroadcast(`fantasy_league:${team[0].league_id}`, {
        type: 'team_update',
        data: {
          team_id: teamId,
          supported_team_id,
          supported_team_name,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Now supporting ${supported_team_name}`,
      team_id: teamId,
      supported_team_id,
      supported_team_name,
    });
  } catch (error) {
    console.error('Error selecting supported team:', error);
    return NextResponse.json(
      { error: 'Failed to select supported team' },
      { status: 500 }
    );
  }
}
