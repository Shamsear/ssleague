import { fantasySql } from '@/lib/neon/fantasy-config';
import { checkAchievements } from './achievements';

interface TradeProposal {
  league_id: string;
  team_a_id: string; // Proposer
  team_b_id: string; // Receiver
  trade_type: 'sale' | 'swap';
  team_a_players: string[]; // Players from team A
  team_b_players: string[]; // Players from team B
  team_a_cash: number; // Cash from team A
  team_b_cash: number; // Cash from team B
  expires_in_hours: number;
}

/**
 * Propose a trade between two teams
 */
export async function proposeTrade(proposal: TradeProposal) {
  try {
    // 1. Validate trade proposal
    const validation = await validateTradeProposal(proposal);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // 2. Calculate trade value
    const tradeValue = await calculateTradeValue(proposal);

    // 3. Generate trade ID
    const tradeId = `trade_${proposal.team_a_id}_${proposal.team_b_id}_${Date.now()}`;

    // 4. Calculate expiry time
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + proposal.expires_in_hours);

    // 5. Store trade proposal
    await fantasySql`
      INSERT INTO fantasy_trades (
        trade_id,
        league_id,
        team_a_id,
        team_b_id,
        trade_type,
        team_a_players,
        team_b_players,
        team_a_cash,
        team_b_cash,
        status,
        proposed_at,
        expires_at,
        created_at,
        updated_at
      )
      VALUES (
        ${tradeId},
        ${proposal.league_id},
        ${proposal.team_a_id},
        ${proposal.team_b_id},
        ${proposal.trade_type},
        ${JSON.stringify(proposal.team_a_players)},
        ${JSON.stringify(proposal.team_b_players)},
        ${proposal.team_a_cash},
        ${proposal.team_b_cash},
        'pending',
        NOW(),
        ${expiresAt.toISOString()},
        NOW(),
        NOW()
      )
    `;

    return {
      success: true,
      trade_id: tradeId,
      expires_at: expiresAt.toISOString(),
      trade_value: tradeValue,
      message: 'Trade proposal sent successfully'
    };

  } catch (error: any) {
    console.error('Error proposing trade:', error);
    throw new Error(`Failed to propose trade: ${error.message}`);
  }
}

/**
 * Validate a trade proposal
 */
export async function validateTradeProposal(proposal: TradeProposal): Promise<{
  valid: boolean;
  error?: string;
}> {
  try {
    // 1. Check teams are different
    if (proposal.team_a_id === proposal.team_b_id) {
      return { valid: false, error: 'Cannot trade with yourself' };
    }

    // 2. Check both teams are in same league
    const teams = await fantasySql`
      SELECT team_id, league_id, budget
      FROM fantasy_teams
      WHERE team_id IN (${proposal.team_a_id}, ${proposal.team_b_id})
    `;

    if (teams.length !== 2) {
      return { valid: false, error: 'One or both teams not found' };
    }

    const teamA = teams.find((t: any) => t.team_id === proposal.team_a_id);
    const teamB = teams.find((t: any) => t.team_id === proposal.team_b_id);

    if (teamA.league_id !== teamB.league_id) {
      return { valid: false, error: 'Teams must be in same league' };
    }

    if (teamA.league_id !== proposal.league_id) {
      return { valid: false, error: 'Teams not in specified league' };
    }

    // 3. Validate trade type
    if (proposal.trade_type === 'sale') {
      // Sale: Only one team gives players, other gives cash
      if (proposal.team_a_players.length === 0 && proposal.team_b_players.length === 0) {
        return { valid: false, error: 'Sale must include at least one player' };
      }
      if (proposal.team_a_players.length > 0 && proposal.team_b_players.length > 0) {
        return { valid: false, error: 'Sale cannot include players from both teams' };
      }
      if (proposal.team_a_cash === 0 && proposal.team_b_cash === 0) {
        return { valid: false, error: 'Sale must include cash' };
      }
    } else if (proposal.trade_type === 'swap') {
      // Swap: Both teams must give players
      if (proposal.team_a_players.length === 0 || proposal.team_b_players.length === 0) {
        return { valid: false, error: 'Swap must include players from both teams' };
      }
    }

    // 4. Validate players belong to correct teams
    if (proposal.team_a_players.length > 0) {
      const teamAPlayers = await fantasySql`
        SELECT real_player_id
        FROM fantasy_squad
        WHERE team_id = ${proposal.team_a_id}
          AND real_player_id = ANY(${proposal.team_a_players})
      `;

      if (teamAPlayers.length !== proposal.team_a_players.length) {
        return { valid: false, error: 'Some players not in Team A squad' };
      }
    }

    if (proposal.team_b_players.length > 0) {
      const teamBPlayers = await fantasySql`
        SELECT real_player_id
        FROM fantasy_squad
        WHERE team_id = ${proposal.team_b_id}
          AND real_player_id = ANY(${proposal.team_b_players})
      `;

      if (teamBPlayers.length !== proposal.team_b_players.length) {
        return { valid: false, error: 'Some players not in Team B squad' };
      }
    }

    // 5. Check budget constraints
    const teamABudget = parseFloat(teamA.budget);
    const teamBBudget = parseFloat(teamB.budget);

    if (proposal.team_a_cash > teamABudget) {
      return { valid: false, error: 'Team A has insufficient budget' };
    }

    if (proposal.team_b_cash > teamBBudget) {
      return { valid: false, error: 'Team B has insufficient budget' };
    }

    // 6. Check squad size limits after trade
    const [teamASquadCount] = await fantasySql`
      SELECT COUNT(*) as count
      FROM fantasy_squad
      WHERE team_id = ${proposal.team_a_id}
    `;

    const [teamBSquadCount] = await fantasySql`
      SELECT COUNT(*) as count
      FROM fantasy_squad
      WHERE team_id = ${proposal.team_b_id}
    `;

    const teamANewSize = parseInt(teamASquadCount.count) 
      - proposal.team_a_players.length 
      + proposal.team_b_players.length;

    const teamBNewSize = parseInt(teamBSquadCount.count) 
      - proposal.team_b_players.length 
      + proposal.team_a_players.length;

    const minSquadSize = 5;
    const maxSquadSize = 15;

    if (teamANewSize < minSquadSize || teamANewSize > maxSquadSize) {
      return { valid: false, error: `Team A squad size would be ${teamANewSize} (must be ${minSquadSize}-${maxSquadSize})` };
    }

    if (teamBNewSize < minSquadSize || teamBNewSize > maxSquadSize) {
      return { valid: false, error: `Team B squad size would be ${teamBNewSize} (must be ${minSquadSize}-${maxSquadSize})` };
    }

    // 7. Check expiry time is reasonable
    if (proposal.expires_in_hours < 1 || proposal.expires_in_hours > 168) {
      return { valid: false, error: 'Expiry time must be between 1 and 168 hours (7 days)' };
    }

    return { valid: true };

  } catch (error: any) {
    console.error('Error validating trade:', error);
    return { valid: false, error: error.message };
  }
}

/**
 * Calculate trade value for fairness indicator
 */
export async function calculateTradeValue(proposal: TradeProposal) {
  try {
    let teamAValue = proposal.team_a_cash;
    let teamBValue = proposal.team_b_cash;

    // Get player values from Team A
    if (proposal.team_a_players.length > 0) {
      const teamAPlayers = await fantasySql`
        SELECT SUM(purchase_price) as total
        FROM fantasy_squad
        WHERE team_id = ${proposal.team_a_id}
          AND real_player_id = ANY(${proposal.team_a_players})
      `;
      teamAValue += parseFloat(teamAPlayers[0]?.total || 0);
    }

    // Get player values from Team B
    if (proposal.team_b_players.length > 0) {
      const teamBPlayers = await fantasySql`
        SELECT SUM(purchase_price) as total
        FROM fantasy_squad
        WHERE team_id = ${proposal.team_b_id}
          AND real_player_id = ANY(${proposal.team_b_players})
      `;
      teamBValue += parseFloat(teamBPlayers[0]?.total || 0);
    }

    const difference = Math.abs(teamAValue - teamBValue);
    const averageValue = (teamAValue + teamBValue) / 2;
    const fairnessPercentage = averageValue > 0 
      ? ((1 - (difference / averageValue)) * 100)
      : 100;

    return {
      team_a_value: teamAValue,
      team_b_value: teamBValue,
      difference: difference,
      fairness_percentage: Math.max(0, Math.min(100, fairnessPercentage))
    };

  } catch (error: any) {
    console.error('Error calculating trade value:', error);
    throw error;
  }
}

/**
 * Get incoming trade proposals for a team
 */
export async function getIncomingTrades(teamId: string) {
  try {
    const trades = await fantasySql`
      SELECT 
        t.trade_id,
        t.league_id,
        t.team_a_id,
        t.team_b_id,
        t.trade_type,
        t.team_a_players,
        t.team_b_players,
        t.team_a_cash,
        t.team_b_cash,
        t.status,
        t.proposed_at,
        t.expires_at,
        ta.team_name as team_a_name,
        tb.team_name as team_b_name
      FROM fantasy_trades t
      LEFT JOIN fantasy_teams ta ON t.team_a_id = ta.team_id
      LEFT JOIN fantasy_teams tb ON t.team_b_id = tb.team_id
      WHERE t.team_b_id = ${teamId}
        AND t.status = 'pending'
        AND t.expires_at > NOW()
      ORDER BY t.proposed_at DESC
    `;

    return trades;
  } catch (error: any) {
    console.error('Error getting incoming trades:', error);
    throw error;
  }
}

/**
 * Get outgoing trade proposals from a team
 */
export async function getOutgoingTrades(teamId: string) {
  try {
    const trades = await fantasySql`
      SELECT 
        t.trade_id,
        t.league_id,
        t.team_a_id,
        t.team_b_id,
        t.trade_type,
        t.team_a_players,
        t.team_b_players,
        t.team_a_cash,
        t.team_b_cash,
        t.status,
        t.proposed_at,
        t.expires_at,
        ta.team_name as team_a_name,
        tb.team_name as team_b_name
      FROM fantasy_trades t
      LEFT JOIN fantasy_teams ta ON t.team_a_id = ta.team_id
      LEFT JOIN fantasy_teams tb ON t.team_b_id = tb.team_id
      WHERE t.team_a_id = ${teamId}
        AND t.status IN ('pending', 'accepted', 'rejected')
      ORDER BY t.proposed_at DESC
      LIMIT 50
    `;

    return trades;
  } catch (error: any) {
    console.error('Error getting outgoing trades:', error);
    throw error;
  }
}

/**
 * Cancel a pending trade proposal
 */
export async function cancelTrade(tradeId: string, teamId: string) {
  try {
    // Verify the team is the proposer
    const [trade] = await fantasySql`
      SELECT trade_id, team_a_id, status
      FROM fantasy_trades
      WHERE trade_id = ${tradeId}
    `;

    if (!trade) {
      throw new Error('Trade not found');
    }

    if (trade.team_a_id !== teamId) {
      throw new Error('Only the proposer can cancel a trade');
    }

    if (trade.status !== 'pending') {
      throw new Error('Can only cancel pending trades');
    }

    // Update trade status
    await fantasySql`
      UPDATE fantasy_trades
      SET 
        status = 'cancelled',
        updated_at = NOW()
      WHERE trade_id = ${tradeId}
    `;

    return {
      success: true,
      message: 'Trade cancelled successfully'
    };

  } catch (error: any) {
    console.error('Error cancelling trade:', error);
    throw error;
  }
}

/**
 * Expire old pending trades
 */
export async function expireOldTrades(leagueId: string) {
  try {
    const result = await fantasySql`
      UPDATE fantasy_trades
      SET 
        status = 'expired',
        updated_at = NOW()
      WHERE league_id = ${leagueId}
        AND status = 'pending'
        AND expires_at <= NOW()
      RETURNING trade_id
    `;

    return {
      success: true,
      expired_count: result.length
    };

  } catch (error: any) {
    console.error('Error expiring trades:', error);
    throw error;
  }
}

/**
 * Respond to a trade proposal (accept or reject)
 */
export async function respondToTrade(
  tradeId: string,
  teamId: string,
  action: 'accept' | 'reject',
  responseMessage?: string
) {
  try {
    // 1. Get trade details
    const [trade] = await fantasySql`
      SELECT 
        trade_id,
        league_id,
        team_a_id,
        team_b_id,
        trade_type,
        team_a_players,
        team_b_players,
        team_a_cash,
        team_b_cash,
        status,
        expires_at
      FROM fantasy_trades
      WHERE trade_id = ${tradeId}
    `;

    if (!trade) {
      throw new Error('Trade not found');
    }

    // 2. Verify team is the receiver
    if (trade.team_b_id !== teamId) {
      throw new Error('Only the receiver can respond to this trade');
    }

    // 3. Check trade status
    if (trade.status !== 'pending') {
      throw new Error(`Trade is ${trade.status}, cannot respond`);
    }

    // 4. Check if expired
    const now = new Date();
    const expiresAt = new Date(trade.expires_at);
    if (now > expiresAt) {
      // Mark as expired
      await fantasySql`
        UPDATE fantasy_trades
        SET status = 'expired', updated_at = NOW()
        WHERE trade_id = ${tradeId}
      `;
      throw new Error('Trade has expired');
    }

    // 5. If rejecting, just update status
    if (action === 'reject') {
      await fantasySql`
        UPDATE fantasy_trades
        SET 
          status = 'rejected',
          responded_at = NOW(),
          response_message = ${responseMessage || 'Trade rejected'},
          updated_at = NOW()
        WHERE trade_id = ${tradeId}
      `;

      return {
        success: true,
        action: 'rejected',
        message: 'Trade rejected successfully'
      };
    }

    // 6. If accepting, execute the trade
    if (action === 'accept') {
      // Re-validate trade (in case squads changed)
      const validation = await validateTradeProposal({
        league_id: trade.league_id,
        team_a_id: trade.team_a_id,
        team_b_id: trade.team_b_id,
        trade_type: trade.trade_type,
        team_a_players: trade.team_a_players,
        team_b_players: trade.team_b_players,
        team_a_cash: parseFloat(trade.team_a_cash),
        team_b_cash: parseFloat(trade.team_b_cash),
        expires_in_hours: 1 // Dummy value for validation
      });

      if (!validation.valid) {
        throw new Error(`Trade no longer valid: ${validation.error}`);
      }

      // Execute the trade
      await executeTrade(trade);

      // Update trade status
      await fantasySql`
        UPDATE fantasy_trades
        SET 
          status = 'accepted',
          responded_at = NOW(),
          response_message = ${responseMessage || 'Trade accepted'},
          updated_at = NOW()
        WHERE trade_id = ${tradeId}
      `;

      return {
        success: true,
        action: 'accepted',
        message: 'Trade executed successfully',
        trade_details: {
          team_a_players: trade.team_a_players,
          team_b_players: trade.team_b_players,
          team_a_cash: parseFloat(trade.team_a_cash),
          team_b_cash: parseFloat(trade.team_b_cash)
        }
      };
    }

    throw new Error('Invalid action');

  } catch (error: any) {
    console.error('Error responding to trade:', error);
    throw error;
  }
}

/**
 * Execute a trade (swap players and cash)
 */
async function executeTrade(trade: any) {
  try {
    const teamAPlayers = trade.team_a_players;
    const teamBPlayers = trade.team_b_players;
    const teamACash = parseFloat(trade.team_a_cash);
    const teamBCash = parseFloat(trade.team_b_cash);

    // 1. Transfer players from Team A to Team B
    if (teamAPlayers.length > 0) {
      for (const playerId of teamAPlayers) {
        // Get player's purchase price
        const [squadPlayer] = await fantasySql`
          SELECT purchase_price
          FROM fantasy_squad
          WHERE team_id = ${trade.team_a_id}
            AND real_player_id = ${playerId}
        `;

        // Remove from Team A
        await fantasySql`
          DELETE FROM fantasy_squad
          WHERE team_id = ${trade.team_a_id}
            AND real_player_id = ${playerId}
        `;

        // Add to Team B
        await fantasySql`
          INSERT INTO fantasy_squad (
            team_id,
            real_player_id,
            purchase_price,
            added_at
          )
          VALUES (
            ${trade.team_b_id},
            ${playerId},
            ${squadPlayer.purchase_price},
            NOW()
          )
        `;
      }
    }

    // 2. Transfer players from Team B to Team A
    if (teamBPlayers.length > 0) {
      for (const playerId of teamBPlayers) {
        // Get player's purchase price
        const [squadPlayer] = await fantasySql`
          SELECT purchase_price
          FROM fantasy_squad
          WHERE team_id = ${trade.team_b_id}
            AND real_player_id = ${playerId}
        `;

        // Remove from Team B
        await fantasySql`
          DELETE FROM fantasy_squad
          WHERE team_id = ${trade.team_b_id}
            AND real_player_id = ${playerId}
        `;

        // Add to Team A
        await fantasySql`
          INSERT INTO fantasy_squad (
            team_id,
            real_player_id,
            purchase_price,
            added_at
          )
          VALUES (
            ${trade.team_a_id},
            ${playerId},
            ${squadPlayer.purchase_price},
            NOW()
          )
        `;
      }
    }

    // 3. Transfer cash from Team A to Team B
    if (teamACash > 0) {
      await fantasySql`
        UPDATE fantasy_teams
        SET budget = budget - ${teamACash}
        WHERE team_id = ${trade.team_a_id}
      `;

      await fantasySql`
        UPDATE fantasy_teams
        SET budget = budget + ${teamACash}
        WHERE team_id = ${trade.team_b_id}
      `;
    }

    // 4. Transfer cash from Team B to Team A
    if (teamBCash > 0) {
      await fantasySql`
        UPDATE fantasy_teams
        SET budget = budget - ${teamBCash}
        WHERE team_id = ${trade.team_b_id}
      `;

      await fantasySql`
        UPDATE fantasy_teams
        SET budget = budget + ${teamBCash}
        WHERE team_id = ${trade.team_a_id}
      `;
    }

    console.log('Trade executed successfully:', {
      trade_id: trade.trade_id,
      players_swapped: teamAPlayers.length + teamBPlayers.length,
      cash_transferred: teamACash + teamBCash
    });

    // 5. Check achievements for both teams after trade
    try {
      await Promise.all([
        checkAchievements(trade.team_a_id, trade.league_id),
        checkAchievements(trade.team_b_id, trade.league_id)
      ]);
    } catch (error: any) {
      console.error('Error checking achievements after trade:', error);
      // Don't fail the trade if achievement checking fails
    }

  } catch (error: any) {
    console.error('Error executing trade:', error);
    throw new Error(`Failed to execute trade: ${error.message}`);
  }
}

/**
 * Get trade details by ID
 */
export async function getTradeDetails(tradeId: string) {
  try {
    const [trade] = await fantasySql`
      SELECT 
        t.trade_id,
        t.league_id,
        t.team_a_id,
        t.team_b_id,
        t.trade_type,
        t.team_a_players,
        t.team_b_players,
        t.team_a_cash,
        t.team_b_cash,
        t.status,
        t.proposed_at,
        t.expires_at,
        t.responded_at,
        t.response_message,
        ta.team_name as team_a_name,
        tb.team_name as team_b_name
      FROM fantasy_trades t
      LEFT JOIN fantasy_teams ta ON t.team_a_id = ta.team_id
      LEFT JOIN fantasy_teams tb ON t.team_b_id = tb.team_id
      WHERE t.trade_id = ${tradeId}
    `;

    if (!trade) {
      throw new Error('Trade not found');
    }

    return trade;
  } catch (error: any) {
    console.error('Error getting trade details:', error);
    throw error;
  }
}
