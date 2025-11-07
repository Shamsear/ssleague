import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';
import { sendNotification } from '@/lib/notifications/send-notification';

/**
 * POST /api/fantasy/transfers/make
 * Make a transfer (sell player out, buy player in)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, player_out_id, player_in_id } = body;

    if (!user_id || !player_out_id || !player_in_id) {
      return NextResponse.json(
        { error: 'user_id, player_out_id, and player_in_id are required' },
        { status: 400 }
      );
    }

    // Get user's team
    const teams = await fantasySql`
      SELECT * FROM fantasy_teams
      WHERE owner_uid = ${user_id} AND is_enabled = true
      LIMIT 1
    `;

    if (teams.length === 0) {
      return NextResponse.json(
        { error: 'Fantasy team not found' },
        { status: 404 }
      );
    }

    const team = teams[0];
    const teamId = team.team_id;
    const leagueId = team.league_id;

    // Check if there's an active transfer window
    const activeWindows = await fantasySql`
      SELECT * FROM transfer_windows
      WHERE league_id = ${leagueId} AND is_active = true
      LIMIT 1
    `;

    if (activeWindows.length === 0) {
      return NextResponse.json(
        { error: 'No active transfer window. Transfers are currently closed.' },
        { status: 403 }
      );
    }

    const activeWindow = activeWindows[0];

    // Validate player_out is in squad
    const playerOut = await fantasySql`
      SELECT * FROM fantasy_squad
      WHERE team_id = ${teamId} AND real_player_id = ${player_out_id}
      LIMIT 1
    `;

    if (playerOut.length === 0) {
      return NextResponse.json(
        { error: 'Player to sell is not in your squad' },
        { status: 400 }
      );
    }

    // Get player_in details from fantasy_players
    const playerIn = await fantasySql`
      SELECT * FROM fantasy_players
      WHERE league_id = ${leagueId} AND real_player_id = ${player_in_id}
      LIMIT 1
    `;

    if (playerIn.length === 0) {
      return NextResponse.json(
        { error: 'Player to buy not found in fantasy league' },
        { status: 404 }
      );
    }

    // Check if player_in is already in squad
    const alreadyOwned = await fantasySql`
      SELECT * FROM fantasy_squad
      WHERE team_id = ${teamId} AND real_player_id = ${player_in_id}
      LIMIT 1
    `;

    if (alreadyOwned.length === 0) {
      return NextResponse.json(
        { error: 'Player is already in your squad' },
        { status: 400 }
      );
    }

    // Check budget
    const sellPrice = Number(playerOut[0].current_value);
    const buyPrice = Number(playerIn[0].current_price);
    const budgetRemaining = Number(team.budget_remaining) || 0;
    const newBudget = budgetRemaining + sellPrice - buyPrice;

    if (newBudget < 0) {
      return NextResponse.json(
        {
          error: 'Insufficient budget',
          available: budgetRemaining + sellPrice,
          required: buyPrice,
        },
        { status: 400 }
      );
    }

    // Record transfer
    const transferId = `transfer_${teamId}_${Date.now()}`;
    await fantasySql`
      INSERT INTO fantasy_transfers (
        transfer_id, league_id, team_id, window_id,
        player_out_id, player_out_name,
        player_in_id, player_in_name,
        transfer_cost, is_free_transfer
      ) VALUES (
        ${transferId}, ${leagueId}, ${teamId}, ${activeWindow.window_id},
        ${player_out_id}, ${playerOut[0].player_name},
        ${player_in_id}, ${playerIn[0].player_name},
        0, true
      )
    `;

    // Remove player from squad
    await fantasySql`
      DELETE FROM fantasy_squad
      WHERE team_id = ${teamId} AND real_player_id = ${player_out_id}
    `;

    // Add new player to squad
    const squadId = `squad_${teamId}_${player_in_id}_${Date.now()}`;
    await fantasySql`
      INSERT INTO fantasy_squad (
        squad_id, team_id, league_id, real_player_id,
        player_name, position, real_team_name,
        purchase_price, current_value, acquisition_type
      ) VALUES (
        ${squadId}, ${teamId}, ${leagueId}, ${player_in_id},
        ${playerIn[0].player_name}, ${playerIn[0].position || 'Unknown'}, 
        ${playerIn[0].real_team_name || 'Unknown'},
        ${buyPrice}, ${buyPrice}, 'transfer'
      )
    `;

    // Update fantasy_players: player_out becomes available, player_in becomes unavailable
    await fantasySql`
      UPDATE fantasy_players
      SET is_available = true, updated_at = NOW()
      WHERE league_id = ${leagueId} AND real_player_id = ${player_out_id}
    `;

    await fantasySql`
      UPDATE fantasy_players
      SET 
        times_drafted = COALESCE(times_drafted, 0) + 1,
        is_available = false,
        updated_at = NOW()
      WHERE league_id = ${leagueId} AND real_player_id = ${player_in_id}
    `;

    // Update team budget
    await fantasySql`
      UPDATE fantasy_teams
      SET budget_remaining = ${newBudget},
          updated_at = CURRENT_TIMESTAMP
      WHERE team_id = ${teamId}
    `;

    console.log(`✅ Transfer completed: ${playerOut[0].player_name} → ${playerIn[0].player_name}`);

    // Send FCM notification to the team
    try {
      await sendNotification(
        {
          title: '✅ Transfer Complete!',
          body: `Sold ${playerOut[0].player_name}, bought ${playerIn[0].player_name}. Budget: £${newBudget.toFixed(2)}`,
          url: `/fantasy/squad`,
          icon: '/logo.png',
          data: {
            type: 'fantasy_transfer',
            player_out: playerOut[0].player_name,
            player_in: playerIn[0].player_name,
            budget_remaining: newBudget.toString(),
          }
        },
        teamId
      );
    } catch (notifError) {
      console.error('Failed to send transfer notification:', notifError);
      // Don't fail the request
    }

    return NextResponse.json({
      success: true,
      message: 'Transfer completed successfully',
      transfer: {
        player_out: playerOut[0].player_name,
        player_in: playerIn[0].player_name,
        budget_remaining: newBudget,
      },
    });
  } catch (error) {
    console.error('Error making transfer:', error);
    return NextResponse.json(
      { error: 'Failed to complete transfer', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
