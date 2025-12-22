import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * POST /api/fantasy/transfers/execute
 * Execute a fantasy transfer (release + sign)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      user_id,
      player_out_id, // squad_id to release (optional for pure additions)
      player_in_id,  // real_player_id to sign
    } = body;

    console.log('🔄 Transfer request:', { user_id, player_out_id, player_in_id });

    if (!user_id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Must have at least one action (release or sign)
    if (!player_out_id && !player_in_id) {
      return NextResponse.json(
        { error: 'Must specify at least one player (to release or sign)' },
        { status: 400 }
      );
    }

    // Get user's fantasy team
    const teams = await fantasySql`
      SELECT * FROM fantasy_teams
      WHERE owner_uid = ${user_id} AND is_enabled = true
      LIMIT 1
    `;

    if (teams.length === 0) {
      return NextResponse.json(
        { error: 'No fantasy team found' },
        { status: 404 }
      );
    }

    const team = teams[0];
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
    const minSquadSize = Number(league.min_squad_size || 11);
    const maxSquadSize = Number(league.max_squad_size || 15);

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
    const maxTransfers = Number(window.max_transfers_per_window || 3);
    const pointsCost = Number(window.points_cost_per_transfer || 4);

    // Count transfers made in this window
    const transferCount = await fantasySql`
      SELECT COUNT(*) as count
      FROM fantasy_transfers
      WHERE team_id = ${teamId}
        AND window_id = ${window.window_id}
    `;

    const transfersUsed = Number(transferCount[0]?.count || 0);

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

    // Get current squad
    const currentSquad = await fantasySql`
      SELECT * FROM fantasy_squad
      WHERE team_id = ${teamId}
    `;

    const currentSquadSize = currentSquad.length;

    // Get player being released (if any)
    let releasedPlayer = null;
    let budgetRefund = 0;

    if (player_out_id) {
      const playerOut = await fantasySql`
        SELECT * FROM fantasy_squad
        WHERE squad_id = ${player_out_id}
          AND team_id = ${teamId}
        LIMIT 1
      `;

      if (playerOut.length === 0) {
        return NextResponse.json(
          { error: 'Player to release not found in your squad' },
          { status: 404 }
        );
      }

      releasedPlayer = playerOut[0];
      budgetRefund = Number(releasedPlayer.purchase_price || 0);
    }

    // Get player being signed (if specified)
    let playerIn = null;
    let playerCost = 0;

    if (player_in_id) {
      // First, try to get from fantasy_players
      const playersIn = await fantasySql`
        SELECT * FROM fantasy_players
        WHERE league_id = ${leagueId}
          AND real_player_id = ${player_in_id}
        LIMIT 1
      `;

      if (playersIn.length === 0) {
        // Player not in fantasy_players, fetch from player_seasons and add them
        console.log(`Player ${player_in_id} not in fantasy_players, fetching from player_seasons...`);
        
        const playerSeasons = await fantasySql`
          SELECT * FROM player_seasons
          WHERE player_id = ${player_in_id}
          LIMIT 1
        `;

        if (playerSeasons.length === 0) {
          return NextResponse.json(
            { error: 'Player not found in player_seasons table' },
            { status: 404 }
          );
        }

        const playerData = playerSeasons[0];
        
        console.log('Player data from player_seasons:', {
          player_id: playerData.player_id,
          player_name: playerData.player_name,
          position: playerData.position,
          team_id: playerData.team_id,
          team: playerData.team,
          star_rating: playerData.star_rating
        });
        
        // Validate player data from player_seasons
        if (!playerData.player_name) {
          return NextResponse.json(
            { error: `Player data incomplete in player_seasons - missing player name for ID: ${player_in_id}` },
            { status: 400 }
          );
        }
        
        // Get star pricing from league
        const starPricing: Record<number, number> = {};
        if (league.star_rating_prices) {
          league.star_rating_prices.forEach((p: any) => {
            starPricing[p.stars] = p.price;
          });
        } else {
          // Default pricing if not set
          starPricing[3] = 5;
          starPricing[4] = 7;
          starPricing[5] = 10;
        }

        // Calculate price based on star rating
        const starRating = Number(playerData.star_rating || 3);
        const calculatedPrice = starPricing[starRating] || 5;
        
        // Get data from player_seasons columns
        const finalPlayerName = playerData.player_name;
        const finalPosition = playerData.position || 'Unknown';
        const finalTeamName = playerData.team || 'Unknown';
        
        // Add player to fantasy_players
        await fantasySql`
          INSERT INTO fantasy_players (
            league_id, real_player_id, player_name, position,
            real_team_id, real_team_name, draft_price, current_price,
            star_rating, is_available
          ) VALUES (
            ${leagueId}, ${player_in_id}, ${finalPlayerName}, ${finalPosition},
            ${playerData.team_id}, ${finalTeamName}, ${calculatedPrice}, ${calculatedPrice},
            ${starRating}, true
          )
        `;

        console.log(`✅ Added ${finalPlayerName} (${finalTeamName}) to fantasy_players with price €${calculatedPrice}M (${starRating}⭐)`);

        // Now fetch the newly added player
        const newPlayer = await fantasySql`
          SELECT * FROM fantasy_players
          WHERE league_id = ${leagueId}
            AND real_player_id = ${player_in_id}
          LIMIT 1
        `;

        playerIn = newPlayer[0];
      } else {
        playerIn = playersIn[0];
      }

      playerCost = Number(playerIn.current_price || playerIn.draft_price);

      // Check if player is already in YOUR squad
      const existingInMySquad = await fantasySql`
        SELECT * FROM fantasy_squad
        WHERE team_id = ${teamId}
          AND real_player_id = ${player_in_id}
        LIMIT 1
      `;

      if (existingInMySquad.length > 0) {
        return NextResponse.json(
          { error: 'Player already in your squad' },
          { status: 400 }
        );
      }

      // Note: Multiple teams CAN own the same player in fantasy leagues
      // This is intentional - no restriction on shared ownership
    }

    // Calculate new budget
    const currentBudget = Number(team.budget_remaining || 0);
    const newBudget = currentBudget + budgetRefund - playerCost;

    if (newBudget < 0) {
      return NextResponse.json(
        {
          error: 'Insufficient budget',
          required: playerCost,
          available: currentBudget + budgetRefund,
          shortfall: Math.abs(newBudget),
        },
        { status: 400 }
      );
    }

    // Check squad size limits
    let newSquadSize = currentSquadSize;
    
    if (player_out_id && !player_in_id) {
      // Release only
      newSquadSize = currentSquadSize - 1;
      
      if (newSquadSize < minSquadSize) {
        return NextResponse.json(
          {
            error: 'Cannot release player - minimum squad size required',
            current: currentSquadSize,
            min: minSquadSize,
            message: `You must maintain at least ${minSquadSize} players in your squad`,
          },
          { status: 400 }
        );
      }
    } else if (player_in_id && !player_out_id) {
      // Sign only
      newSquadSize = currentSquadSize + 1;
      
      if (newSquadSize > maxSquadSize) {
        return NextResponse.json(
          {
            error: 'Squad size limit exceeded',
            current: currentSquadSize,
            max: maxSquadSize,
            message: 'You must release a player before signing a new one',
          },
          { status: 400 }
        );
      }
    }
    // If both specified, squad size stays the same (swap)

    // Execute the transfer
    const transferId = `transfer_${teamId}_${Date.now()}`;
    const newSquadId = `squad_${teamId}_${player_in_id}_${Date.now()}`;

    // Remove old player if specified
    if (player_out_id && releasedPlayer) {
      await fantasySql`
        DELETE FROM fantasy_squad
        WHERE squad_id = ${player_out_id}
      `;

      console.log(`✅ Released: ${releasedPlayer.player_name} (+€${budgetRefund})`);
    }

    // Add new player (if specified)
    if (player_in_id && playerIn) {
      // Ensure we have required fields with fallbacks
      const playerName = playerIn.player_name || 'Unknown Player';
      const position = playerIn.position || 'Unknown';
      const teamName = playerIn.real_team_name || 'Unknown Team';

      await fantasySql`
        INSERT INTO fantasy_squad (
          squad_id, team_id, league_id, real_player_id,
          player_name, position, real_team_name,
          purchase_price, current_value, acquisition_type,
          is_captain, is_vice_captain
        ) VALUES (
          ${newSquadId}, ${teamId}, ${leagueId}, ${player_in_id},
          ${playerName}, ${position}, ${teamName},
          ${playerCost}, ${playerCost}, 'transfer',
          false, false
        )
      `;

      console.log(`✅ Signed: ${playerName} (-€${playerCost})`);
    }

    // Update team budget
    await fantasySql`
      UPDATE fantasy_teams
      SET budget_remaining = ${newBudget},
          updated_at = NOW()
      WHERE team_id = ${teamId}
    `;

    // Deduct fantasy points if configured
    if (pointsCost > 0) {
      await fantasySql`
        UPDATE fantasy_teams
        SET total_points = GREATEST(0, total_points - ${pointsCost}),
            updated_at = NOW()
        WHERE team_id = ${teamId}
      `;
    }

    // Record the transfer
    await fantasySql`
      INSERT INTO fantasy_transfers (
        transfer_id, league_id, team_id, window_id,
        player_out_id, player_out_name,
        player_in_id, player_in_name,
        transfer_cost, points_deducted, is_free_transfer
      ) VALUES (
        ${transferId}, ${leagueId}, ${teamId}, ${window.window_id},
        ${releasedPlayer?.real_player_id || null}, ${releasedPlayer?.player_name || null},
        ${player_in_id || null}, ${playerIn?.player_name || null},
        ${playerCost}, ${pointsCost}, false
      )
    `;

    // Update player statistics (times drafted)
    if (player_in_id && playerIn) {
      await fantasySql`
        UPDATE fantasy_players
        SET times_drafted = times_drafted + 1,
            updated_at = NOW()
        WHERE league_id = ${leagueId}
          AND real_player_id = ${player_in_id}
      `;
    }

    // Note: We don't update is_available since multiple teams can own the same player

    console.log(`✅ Transfer completed. New budget: €${newBudget}`);

    return NextResponse.json({
      success: true,
      message: 'Transfer completed successfully',
      transfer: {
        player_out: releasedPlayer ? {
          name: releasedPlayer.player_name,
          refund: budgetRefund,
        } : null,
        player_in: playerIn ? {
          name: playerIn.player_name,
          cost: playerCost,
        } : null,
        new_budget: newBudget,
        points_deducted: pointsCost,
        transfers_remaining: maxTransfers - transfersUsed - 1,
      },
    });
  } catch (error) {
    console.error('❌ Transfer error:', error);
    return NextResponse.json(
      { error: 'Failed to execute transfer', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
