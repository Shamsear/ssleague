import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';
import { adminDb } from '@/lib/firebase/admin';

/**
 * POST /api/fantasy/transfers/make-transfer
 * Make a player transfer (swap players)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      user_id,
      player_out_id, // squad_id of player to remove
      player_in_id,  // real_player_id of player to add
      player_in_name,
      player_in_position,
      player_in_team,
      player_in_price,
    } = body;

    if (!user_id || !player_out_id || !player_in_id) {
      return NextResponse.json(
        { error: 'Missing required fields' },
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

    // Get league settings
    const leagues = await fantasySql`
      SELECT * FROM fantasy_leagues
      WHERE league_id = ${leagueId}
      LIMIT 1
    `;

    if (leagues.length === 0) {
      return NextResponse.json(
        { error: 'League not found' },
        { status: 404 }
      );
    }

    const league = leagues[0];

    // Check if transfer window is open
    const activeWindows = await fantasySql`
      SELECT * FROM transfer_windows
      WHERE league_id = ${leagueId}
        AND is_active = true
      LIMIT 1
    `;

    if (activeWindows.length === 0) {
      return NextResponse.json(
        { error: 'Transfer window is closed' },
        { status: 400 }
      );
    }

    const window = activeWindows[0];

    // Count transfers made in this window
    const transfers = await fantasySql`
      SELECT COUNT(*) as count
      FROM fantasy_transfers
      WHERE team_id = ${teamId}
        AND window_id = ${window.window_id}
    `;

    const transfersUsed = Number(transfers[0]?.count || 0);
    const maxTransfers = Number(league.max_transfers_per_window);
    const pointsCost = Number(league.points_cost_per_transfer);

    if (transfersUsed >= maxTransfers) {
      return NextResponse.json(
        {
          error: 'Maximum transfers reached for this window',
          used: transfersUsed,
          max: maxTransfers,
        },
        { status: 400 }
      );
    }

    // Get player being removed
    const playerOut = await fantasySql`
      SELECT * FROM fantasy_squad
      WHERE squad_id = ${player_out_id}
        AND team_id = ${teamId}
      LIMIT 1
    `;

    if (playerOut.length === 0) {
      return NextResponse.json(
        { error: 'Player to remove not found in squad' },
        { status: 404 }
      );
    }

    const outPlayer = playerOut[0];

    // Check if new player is already in squad
    const existing = await fantasySql`
      SELECT * FROM fantasy_squad
      WHERE team_id = ${teamId}
        AND real_player_id = ${player_in_id}
      LIMIT 1
    `;

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'Player already in your squad' },
        { status: 400 }
      );
    }

    // Generate IDs
    const transfer_id = `transfer_${teamId}_${Date.now()}`;
    const new_squad_id = `squad_${teamId}_${player_in_id}_${Date.now()}`;

    // Execute transfer: Remove old player
    await fantasySql`
      DELETE FROM fantasy_squad
      WHERE squad_id = ${player_out_id}
    `;

    // Add new player
    await fantasySql`
      INSERT INTO fantasy_squad (
        squad_id, team_id, league_id, real_player_id,
        player_name, position, real_team_name,
        purchase_price, current_value, acquisition_type
      ) VALUES (
        ${new_squad_id}, ${teamId}, ${leagueId}, ${player_in_id},
        ${player_in_name}, ${player_in_position}, ${player_in_team},
        ${player_in_price}, ${player_in_price}, 'transfer'
      )
    `;

    // Record transfer
    await fantasySql`
      INSERT INTO fantasy_transfers (
        transfer_id, league_id, team_id, window_id,
        player_out_id, player_out_name,
        player_in_id, player_in_name,
        transfer_cost, points_deducted, is_free_transfer
      ) VALUES (
        ${transfer_id}, ${leagueId}, ${teamId}, ${window.window_id},
        ${outPlayer.real_player_id}, ${outPlayer.player_name},
        ${player_in_id}, ${player_in_name},
        ${pointsCost}, ${pointsCost}, false
      )
    `;

    // Deduct points from team
    await fantasySql`
      UPDATE fantasy_teams
      SET total_points = total_points - ${pointsCost},
          updated_at = CURRENT_TIMESTAMP
      WHERE team_id = ${teamId}
    `;

    return NextResponse.json({
      success: true,
      message: 'Transfer completed successfully',
      transfer: {
        player_out: outPlayer.player_name,
        player_in: player_in_name,
        points_cost: pointsCost,
      },
      transfers_remaining: maxTransfers - transfersUsed - 1,
    });
  } catch (error) {
    console.error('Error making transfer:', error);
    return NextResponse.json(
      { error: 'Failed to make transfer', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
