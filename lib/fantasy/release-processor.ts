import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * Release a player from a team's squad
 * Returns 80% of the purchase price to the team
 */
export async function releasePlayer(
  teamId: string,
  playerId: string,
  leagueId: string,
  transferWindowId?: string
) {
  try {
    // 1. Get player from squad
    const [squadPlayer] = await fantasySql`
      SELECT 
        squad_id,
        real_player_id,
        purchase_price,
        added_at
      FROM fantasy_squad
      WHERE team_id = ${teamId}
        AND real_player_id = ${playerId}
    `;

    if (!squadPlayer) {
      throw new Error('Player not found in squad');
    }

    // 2. Calculate refund (80% of purchase price)
    const purchasePrice = parseFloat(squadPlayer.purchase_price);
    const refundPercentage = 80.0;
    const refundAmount = (purchasePrice * refundPercentage) / 100;

    // 3. Get team's current budget
    const [team] = await fantasySql`
      SELECT budget
      FROM fantasy_teams
      WHERE team_id = ${teamId}
    `;

    if (!team) {
      throw new Error('Team not found');
    }

    const currentBudget = parseFloat(team.budget);
    const newBudget = currentBudget + refundAmount;

    // 4. Remove player from squad
    await fantasySql`
      DELETE FROM fantasy_squad
      WHERE squad_id = ${squadPlayer.squad_id}
    `;

    // 5. Update team budget
    await fantasySql`
      UPDATE fantasy_teams
      SET 
        budget = ${newBudget},
        updated_at = NOW()
      WHERE team_id = ${teamId}
    `;

    // 6. Mark player as available
    await fantasySql`
      UPDATE fantasy_players
      SET 
        is_available = true,
        updated_at = NOW()
      WHERE real_player_id = ${playerId}
        AND league_id = ${leagueId}
    `;

    // 7. Record release in database
    const releaseId = `release_${teamId}_${playerId}_${Date.now()}`;
    
    await fantasySql`
      INSERT INTO fantasy_releases (
        release_id,
        league_id,
        team_id,
        real_player_id,
        purchase_price,
        refund_amount,
        refund_percentage,
        transfer_window_id,
        status,
        released_at,
        created_at
      )
      VALUES (
        ${releaseId},
        ${leagueId},
        ${teamId},
        ${playerId},
        ${purchasePrice},
        ${refundAmount},
        ${refundPercentage},
        ${transferWindowId || null},
        'completed',
        NOW(),
        NOW()
      )
    `;

    return {
      success: true,
      release_id: releaseId,
      player_id: playerId,
      purchase_price: purchasePrice,
      refund_amount: refundAmount,
      refund_percentage: refundPercentage,
      new_budget: newBudget
    };

  } catch (error: any) {
    console.error('Error releasing player:', error);
    throw new Error(`Failed to release player: ${error.message}`);
  }
}

/**
 * Release multiple players in a batch
 */
export async function releaseMultiplePlayers(
  teamId: string,
  playerIds: string[],
  leagueId: string,
  transferWindowId?: string
) {
  const results = {
    success: true,
    releases: [] as any[],
    total_refund: 0,
    errors: [] as string[]
  };

  for (const playerId of playerIds) {
    try {
      const release = await releasePlayer(teamId, playerId, leagueId, transferWindowId);
      results.releases.push(release);
      results.total_refund += release.refund_amount;
    } catch (error: any) {
      results.errors.push(`${playerId}: ${error.message}`);
    }
  }

  if (results.errors.length > 0) {
    results.success = false;
  }

  return results;
}

/**
 * Get release history for a team
 */
export async function getTeamReleaseHistory(teamId: string, limit: number = 50) {
  try {
    const releases = await fantasySql`
      SELECT 
        r.release_id,
        r.real_player_id,
        r.purchase_price,
        r.refund_amount,
        r.refund_percentage,
        r.released_at,
        r.transfer_window_id,
        p.player_name,
        p.position,
        p.team_name
      FROM fantasy_releases r
      LEFT JOIN fantasy_players p ON r.real_player_id = p.real_player_id
      WHERE r.team_id = ${teamId}
      ORDER BY r.released_at DESC
      LIMIT ${limit}
    `;

    return releases;
  } catch (error: any) {
    console.error('Error getting release history:', error);
    throw error;
  }
}

/**
 * Get all releases in a transfer window
 */
export async function getWindowReleases(transferWindowId: string) {
  try {
    const releases = await fantasySql`
      SELECT 
        r.release_id,
        r.team_id,
        r.real_player_id,
        r.purchase_price,
        r.refund_amount,
        r.released_at,
        t.team_name,
        p.player_name,
        p.position,
        p.team_name as real_team_name
      FROM fantasy_releases r
      LEFT JOIN fantasy_teams t ON r.team_id = t.team_id
      LEFT JOIN fantasy_players p ON r.real_player_id = p.real_player_id
      WHERE r.transfer_window_id = ${transferWindowId}
      ORDER BY r.released_at DESC
    `;

    return releases;
  } catch (error: any) {
    console.error('Error getting window releases:', error);
    throw error;
  }
}

/**
 * Validate if a player can be released
 */
export async function validateRelease(teamId: string, playerId: string): Promise<{
  valid: boolean;
  error?: string;
  player?: any;
}> {
  try {
    // 1. Check if player is in squad
    const [squadPlayer] = await fantasySql`
      SELECT 
        squad_id,
        real_player_id,
        purchase_price,
        added_at
      FROM fantasy_squad
      WHERE team_id = ${teamId}
        AND real_player_id = ${playerId}
    `;

    if (!squadPlayer) {
      return {
        valid: false,
        error: 'Player not found in squad'
      };
    }

    // 2. Check if player is in any locked lineups
    const [lockedLineup] = await fantasySql`
      SELECT lineup_id
      FROM fantasy_lineups
      WHERE team_id = ${teamId}
        AND is_locked = true
        AND (
          starting_players @> ${JSON.stringify([playerId])}::jsonb
          OR bench_players @> ${JSON.stringify([playerId])}::jsonb
        )
      LIMIT 1
    `;

    if (lockedLineup) {
      return {
        valid: false,
        error: 'Cannot release player in a locked lineup'
      };
    }

    // 3. Check minimum squad size
    const [squadCount] = await fantasySql`
      SELECT COUNT(*) as count
      FROM fantasy_squad
      WHERE team_id = ${teamId}
    `;

    const minSquadSize = 5; // Configurable
    if (parseInt(squadCount.count) <= minSquadSize) {
      return {
        valid: false,
        error: `Cannot release player - minimum squad size is ${minSquadSize}`
      };
    }

    return {
      valid: true,
      player: squadPlayer
    };

  } catch (error: any) {
    console.error('Error validating release:', error);
    return {
      valid: false,
      error: error.message
    };
  }
}

/**
 * Calculate potential refund for a player
 */
export async function calculateRefund(teamId: string, playerId: string): Promise<{
  purchase_price: number;
  refund_amount: number;
  refund_percentage: number;
}> {
  const [squadPlayer] = await fantasySql`
    SELECT purchase_price
    FROM fantasy_squad
    WHERE team_id = ${teamId}
      AND real_player_id = ${playerId}
  `;

  if (!squadPlayer) {
    throw new Error('Player not found in squad');
  }

  const purchasePrice = parseFloat(squadPlayer.purchase_price);
  const refundPercentage = 80.0;
  const refundAmount = (purchasePrice * refundPercentage) / 100;

  return {
    purchase_price: purchasePrice,
    refund_amount: refundAmount,
    refund_percentage: refundPercentage
  };
}

/**
 * Get release statistics for a league
 */
export async function getReleaseStats(leagueId: string, transferWindowId?: string) {
  try {
    const whereClause = transferWindowId
      ? `WHERE league_id = '${leagueId}' AND transfer_window_id = '${transferWindowId}'`
      : `WHERE league_id = '${leagueId}'`;

    const [stats] = await fantasySql`
      SELECT 
        COUNT(*) as total_releases,
        COUNT(DISTINCT team_id) as teams_released,
        SUM(refund_amount) as total_refunded,
        AVG(refund_amount) as avg_refund,
        MAX(refund_amount) as max_refund,
        MIN(refund_amount) as min_refund
      FROM fantasy_releases
      WHERE league_id = ${leagueId}
        ${transferWindowId ? `AND transfer_window_id = ${transferWindowId}` : ''}
    `;

    return {
      total_releases: parseInt(stats.total_releases) || 0,
      teams_released: parseInt(stats.teams_released) || 0,
      total_refunded: parseFloat(stats.total_refunded) || 0,
      avg_refund: parseFloat(stats.avg_refund) || 0,
      max_refund: parseFloat(stats.max_refund) || 0,
      min_refund: parseFloat(stats.min_refund) || 0
    };
  } catch (error: any) {
    console.error('Error getting release stats:', error);
    throw error;
  }
}
