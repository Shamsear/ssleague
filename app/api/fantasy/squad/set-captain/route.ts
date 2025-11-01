import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * POST /api/fantasy/squad/set-captain
 * Set captain and vice-captain for fantasy squad
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, captain_player_id, vice_captain_player_id } = body;

    if (!user_id) {
      return NextResponse.json(
        { error: 'user_id is required' },
        { status: 400 }
      );
    }

    // Get user's fantasy team
    const teams = await fantasySql`
      SELECT team_id, league_id FROM fantasy_teams
      WHERE owner_uid = ${user_id} AND is_enabled = true
      LIMIT 1
    `;

    if (teams.length === 0) {
      return NextResponse.json(
        { error: 'No fantasy team found' },
        { status: 404 }
      );
    }

    const { team_id } = teams[0];

    // Validate that players are in the squad
    if (captain_player_id) {
      const captain = await fantasySql`
        SELECT * FROM fantasy_squad
        WHERE team_id = ${team_id} AND real_player_id = ${captain_player_id}
        LIMIT 1
      `;

      if (captain.length === 0) {
        return NextResponse.json(
          { error: 'Captain player not in your squad' },
          { status: 400 }
        );
      }
    }

    if (vice_captain_player_id) {
      const viceCaptain = await fantasySql`
        SELECT * FROM fantasy_squad
        WHERE team_id = ${team_id} AND real_player_id = ${vice_captain_player_id}
        LIMIT 1
      `;

      if (viceCaptain.length === 0) {
        return NextResponse.json(
          { error: 'Vice-captain player not in your squad' },
          { status: 400 }
        );
      }

      // Can't have same player as both captain and vice-captain
      if (captain_player_id && captain_player_id === vice_captain_player_id) {
        return NextResponse.json(
          { error: 'Captain and vice-captain must be different players' },
          { status: 400 }
        );
      }
    }

    // Clear existing captain/vice-captain
    await fantasySql`
      UPDATE fantasy_squad
      SET is_captain = false, is_vice_captain = false
      WHERE team_id = ${team_id}
    `;

    // Set new captain
    if (captain_player_id) {
      await fantasySql`
        UPDATE fantasy_squad
        SET is_captain = true
        WHERE team_id = ${team_id} AND real_player_id = ${captain_player_id}
      `;
    }

    // Set new vice-captain
    if (vice_captain_player_id) {
      await fantasySql`
        UPDATE fantasy_squad
        SET is_vice_captain = true
        WHERE team_id = ${team_id} AND real_player_id = ${vice_captain_player_id}
      `;
    }

    console.log(`✅ Updated captain/vice-captain for team ${team_id}`);

    // Broadcast to WebSocket subscribers
    const leagueId = teams[0].league_id;
    if (typeof global.wsBroadcast === 'function') {
      global.wsBroadcast(`fantasy_league:${leagueId}`, {
        type: 'team_update',
        data: {
          team_id,
          captain_player_id,
          vice_captain_player_id,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Captain and vice-captain updated successfully',
      captain_player_id,
      vice_captain_player_id,
    });
  } catch (error) {
    console.error('Error setting captain/vice-captain:', error);
    return NextResponse.json(
      { error: 'Failed to set captain/vice-captain', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
