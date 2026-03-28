import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * Auto-lock all lineups that have passed their deadline
 * This should be run as a cron job every hour
 */
export async function autoLockLineups(leagueId: string, roundId: string) {
  try {
    const now = new Date();

    // 1. Find all unlocked lineups past their deadline
    const expiredLineups = await fantasySql`
      SELECT 
        lineup_id,
        team_id,
        lock_deadline
      FROM fantasy_lineups
      WHERE league_id = ${leagueId}
        AND round_id = ${roundId}
        AND is_locked = false
        AND lock_deadline <= ${now.toISOString()}
    `;

    if (expiredLineups.length === 0) {
      return {
        success: true,
        lineups_locked: 0,
        message: 'No lineups to lock'
      };
    }

    // 2. Lock all expired lineups
    const lockedLineupIds = expiredLineups.map((l: any) => l.lineup_id);

    await fantasySql`
      UPDATE fantasy_lineups
      SET 
        is_locked = true,
        locked_at = NOW()
      WHERE lineup_id = ANY(${lockedLineupIds})
    `;

    // 3. Find teams without lineups
    const teamsWithoutLineups = await findTeamsWithoutLineups(leagueId, roundId);

    // 4. Create default lineups for teams without submissions
    let defaultLineupsCreated = 0;
    for (const team of teamsWithoutLineups) {
      const created = await createDefaultLineup(team.team_id, leagueId, roundId, now);
      if (created) {
        defaultLineupsCreated++;
      }
    }

    return {
      success: true,
      lineups_locked: expiredLineups.length,
      default_lineups_created: defaultLineupsCreated,
      teams_without_lineup: teamsWithoutLineups.map((t: any) => t.team_id),
      locked_at: now.toISOString()
    };

  } catch (error: any) {
    console.error('Error auto-locking lineups:', error);
    throw new Error(`Failed to auto-lock lineups: ${error.message}`);
  }
}

/**
 * Find teams that haven't submitted a lineup for this round
 */
async function findTeamsWithoutLineups(leagueId: string, roundId: string) {
  const teamsWithoutLineups = await fantasySql`
    SELECT t.team_id, t.team_name
    FROM fantasy_teams t
    WHERE t.league_id = ${leagueId}
      AND t.status = 'active'
      AND NOT EXISTS (
        SELECT 1 
        FROM fantasy_lineups l
        WHERE l.team_id = t.team_id
          AND l.round_id = ${roundId}
      )
  `;

  return teamsWithoutLineups;
}

/**
 * Create a default lineup for a team using their last week's lineup
 * If no previous lineup exists, use first 5 players from squad
 */
async function createDefaultLineup(
  teamId: string,
  leagueId: string,
  roundId: string,
  deadline: Date
): Promise<boolean> {
  try {
    // 1. Try to get last week's lineup
    const [lastLineup] = await fantasySql`
      SELECT 
        starting_players,
        captain_id,
        vice_captain_id,
        bench_players
      FROM fantasy_lineups
      WHERE team_id = ${teamId}
        AND league_id = ${leagueId}
      ORDER BY round_number DESC
      LIMIT 1
    `;

    let startingPlayers: string[];
    let captainId: string;
    let viceCaptainId: string;
    let benchPlayers: string[];

    if (lastLineup) {
      // Use last week's lineup
      startingPlayers = lastLineup.starting_players;
      captainId = lastLineup.captain_id;
      viceCaptainId = lastLineup.vice_captain_id;
      benchPlayers = lastLineup.bench_players;
    } else {
      // No previous lineup - create from squad
      const squad = await fantasySql`
        SELECT real_player_id
        FROM fantasy_squad
        WHERE team_id = ${teamId}
        ORDER BY added_at ASC
        LIMIT 7
      `;

      if (squad.length < 7) {
        console.warn(`Team ${teamId} has insufficient squad size: ${squad.length}`);
        return false;
      }

      const playerIds = squad.map((p: any) => p.real_player_id);
      startingPlayers = playerIds.slice(0, 5);
      benchPlayers = playerIds.slice(5, 7);
      captainId = playerIds[0];
      viceCaptainId = playerIds[1];
    }

    // 2. Get round number
    const [round] = await fantasySql`
      SELECT round_number
      FROM rounds
      WHERE round_id = ${roundId}
    `;

    const roundNumber = round?.round_number || 1;

    // 3. Create lineup
    const lineupId = `lineup_${teamId}_${roundId}_auto_${Date.now()}`;

    await fantasySql`
      INSERT INTO fantasy_lineups (
        lineup_id,
        league_id,
        team_id,
        round_id,
        round_number,
        starting_players,
        captain_id,
        vice_captain_id,
        bench_players,
        is_locked,
        locked_at,
        lock_deadline,
        created_at,
        updated_at
      )
      VALUES (
        ${lineupId},
        ${leagueId},
        ${teamId},
        ${roundId},
        ${roundNumber},
        ${JSON.stringify(startingPlayers)},
        ${captainId},
        ${viceCaptainId},
        ${JSON.stringify(benchPlayers)},
        true,
        NOW(),
        ${deadline.toISOString()},
        NOW(),
        NOW()
      )
    `;

    console.log(`Created default lineup for team ${teamId}`);
    return true;

  } catch (error: any) {
    console.error(`Error creating default lineup for team ${teamId}:`, error);
    return false;
  }
}

/**
 * Lock a specific lineup manually (for testing or admin use)
 */
export async function lockLineup(lineupId: string): Promise<boolean> {
  try {
    const result = await fantasySql`
      UPDATE fantasy_lineups
      SET 
        is_locked = true,
        locked_at = NOW()
      WHERE lineup_id = ${lineupId}
        AND is_locked = false
      RETURNING lineup_id
    `;

    return result.length > 0;
  } catch (error: any) {
    console.error(`Error locking lineup ${lineupId}:`, error);
    return false;
  }
}

/**
 * Unlock a lineup (for admin use only - emergency situations)
 */
export async function unlockLineup(lineupId: string): Promise<boolean> {
  try {
    const result = await fantasySql`
      UPDATE fantasy_lineups
      SET 
        is_locked = false,
        locked_at = NULL
      WHERE lineup_id = ${lineupId}
      RETURNING lineup_id
    `;

    return result.length > 0;
  } catch (error: any) {
    console.error(`Error unlocking lineup ${lineupId}:`, error);
    return false;
  }
}

/**
 * Get lineup lock status
 */
export async function getLineupLockStatus(teamId: string, roundId: string) {
  try {
    const [lineup] = await fantasySql`
      SELECT 
        lineup_id,
        is_locked,
        locked_at,
        lock_deadline
      FROM fantasy_lineups
      WHERE team_id = ${teamId}
        AND round_id = ${roundId}
    `;

    if (!lineup) {
      return {
        exists: false,
        is_locked: false,
        message: 'No lineup submitted'
      };
    }

    const now = new Date();
    const deadline = new Date(lineup.lock_deadline);
    const isPastDeadline = now >= deadline;

    return {
      exists: true,
      lineup_id: lineup.lineup_id,
      is_locked: lineup.is_locked,
      locked_at: lineup.locked_at,
      lock_deadline: lineup.lock_deadline,
      is_past_deadline: isPastDeadline,
      can_edit: !lineup.is_locked && !isPastDeadline
    };

  } catch (error: any) {
    console.error('Error getting lineup lock status:', error);
    throw error;
  }
}
