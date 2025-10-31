/**
 * Contract Reconciliation API
 * 
 * Purpose: When a season ends and teams re-register for the next season,
 * this endpoint reconciles player contracts to handle:
 * 1. Players with contracts extending beyond their team's registration
 * 2. Teams that didn't re-register for the next season
 * 
 * Example:
 * - Team Azzuri FC: Contract S16-S17 (didn't re-register for S18)
 * - Player John: Contract S17-S18 (signed during S17 transfer window)
 * 
 * Action:
 * - Update John's contract end: S18 → S17 (cut to team's actual period)
 * - For S18: Set John's team_id = NULL (becomes free agent)
 * - Preserve all S17 stats and data
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { getAuctionDb } from '@/lib/neon/auction-config';

export async function POST(request: NextRequest) {
  try {
    const tournamentSql = getTournamentDb();
    const auctionSql = getAuctionDb();
    const body = await request.json();
    
    const { 
      newSeasonId,  // e.g., 'SSPSLS18'
      action = 'preview' // 'preview' or 'execute'
    } = body;

    if (!newSeasonId) {
      return NextResponse.json(
        { success: false, error: 'newSeasonId is required' },
        { status: 400 }
      );
    }

    // Extract season number
    const newSeasonNum = parseInt(newSeasonId.replace(/\D/g, '')) || 0;
    const seasonPrefix = newSeasonId.replace(/\d+$/, '');
    const previousSeasonId = `${seasonPrefix}${newSeasonNum - 1}`;

    console.log(`🔄 Contract Reconciliation: ${previousSeasonId} → ${newSeasonId}`);

    // Step 1: Get all teams that re-registered for the new season
    const registeredTeams = await tournamentSql`
      SELECT DISTINCT team_id, team_code, team_name
      FROM team_seasons
      WHERE season_id = ${newSeasonId}
        AND status = 'registered'
    `;

    const registeredTeamIds = new Set(registeredTeams.map(t => t.team_id));
    console.log(`✅ ${registeredTeams.length} teams re-registered for ${newSeasonId}`);

    // Step 2: Find all REAL PLAYERS (player_seasons) whose contracts include the new season
    const realPlayersWithExtendedContracts = await tournamentSql`
      SELECT 
        player_id,
        player_name,
        season_id,
        team_id,
        team,
        contract_start_season,
        contract_end_season,
        auction_value,
        salary_per_match
      FROM player_seasons
      WHERE season_id = ${previousSeasonId}
        AND contract_end_season IS NOT NULL
        AND (
          -- Contract ends at or after new season (e.g., ends at S18, S19, S18.5)
          contract_end_season >= ${newSeasonId}
          OR contract_end_season LIKE ${newSeasonId + '%'}
        )
      ORDER BY team_id, player_name
    `;

    console.log(`📋 Found ${realPlayersWithExtendedContracts.length} real players with contracts extending to ${newSeasonId}`);

    // Step 2.5: Find all FOOTBALL PLAYERS whose contracts include the new season
    const footballPlayersWithExtendedContracts = await auctionSql`
      SELECT 
        player_id,
        name as player_name,
        season_id,
        team_id,
        team_name,
        contract_start_season,
        contract_end_season,
        acquisition_value
      FROM footballplayers
      WHERE season_id = ${previousSeasonId}
        AND contract_end_season IS NOT NULL
        AND (
          contract_end_season >= ${newSeasonId}
          OR contract_end_season LIKE ${newSeasonId + '%'}
        )
      ORDER BY team_id, name
    `;

    console.log(`📋 Found ${footballPlayersWithExtendedContracts.length} football players with contracts extending to ${newSeasonId}`);

    // Step 3: Categorize players (both real and football)
    const playersToRelease: any[] = [];  // Team didn't re-register
    const playersToKeep: any[] = [];     // Team re-registered
    const playersWithExpiredContracts: any[] = []; // Contract ends before new season

    // Process real players
    for (const player of realPlayersWithExtendedContracts) {
      if (!player.team_id) {
        // Already unassigned
        continue;
      }

      if (registeredTeamIds.has(player.team_id)) {
        playersToKeep.push({
          player_id: player.player_id,
          player_name: player.player_name,
          player_type: 'Real Player',
          team_id: player.team_id,
          team_name: player.team,
          contract: `${player.contract_start_season} → ${player.contract_end_season}`,
          action: 'Keep on team (team re-registered)'
        });
      } else {
        playersToRelease.push({
          player_id: player.player_id,
          player_name: player.player_name,
          player_type: 'Real Player',
          team_id: player.team_id,
          team_name: player.team,
          contract_original: `${player.contract_start_season} → ${player.contract_end_season}`,
          contract_cut_to: `${player.contract_start_season} → ${previousSeasonId}`,
          action: 'Cut contract & release (team not re-registered)',
          previousSeasonId,
          newSeasonId
        });
      }
    }

    // Process football players
    for (const player of footballPlayersWithExtendedContracts) {
      if (!player.team_id) {
        continue;
      }

      if (registeredTeamIds.has(player.team_id)) {
        playersToKeep.push({
          player_id: player.player_id,
          player_name: player.player_name,
          player_type: 'Football Player',
          team_id: player.team_id,
          team_name: player.team_name,
          contract: `${player.contract_start_season} → ${player.contract_end_season}`,
          action: 'Keep on team (team re-registered)'
        });
      } else {
        playersToRelease.push({
          player_id: player.player_id,
          player_name: player.player_name,
          player_type: 'Football Player',
          team_id: player.team_id,
          team_name: player.team_name,
          contract_original: `${player.contract_start_season} → ${player.contract_end_season}`,
          contract_cut_to: `${player.contract_start_season} → ${previousSeasonId}`,
          action: 'Cut contract & release (team not re-registered)',
          previousSeasonId,
          newSeasonId
        });
      }
    }

    // Also find REAL players whose contracts expired before the new season
    const expiredRealPlayers = await tournamentSql`
      SELECT 
        player_id,
        player_name,
        season_id,
        team_id,
        team,
        contract_start_season,
        contract_end_season
      FROM player_seasons
      WHERE season_id = ${previousSeasonId}
        AND contract_end_season IS NOT NULL
        AND contract_end_season < ${newSeasonId}
        AND team_id IS NOT NULL
      ORDER BY team_id, player_name
    `;

    for (const player of expiredRealPlayers) {
      playersWithExpiredContracts.push({
        player_id: player.player_id,
        player_name: player.player_name,
        player_type: 'Real Player',
        team_id: player.team_id,
        team_name: player.team,
        contract: `${player.contract_start_season} → ${player.contract_end_season}`,
        action: 'Contract expired naturally'
      });
    }

    // Also find FOOTBALL players whose contracts expired
    const expiredFootballPlayers = await auctionSql`
      SELECT 
        player_id,
        name as player_name,
        season_id,
        team_id,
        team_name,
        contract_start_season,
        contract_end_season
      FROM footballplayers
      WHERE season_id = ${previousSeasonId}
        AND contract_end_season IS NOT NULL
        AND contract_end_season < ${newSeasonId}
        AND team_id IS NOT NULL
      ORDER BY team_id, name
    `;

    for (const player of expiredFootballPlayers) {
      playersWithExpiredContracts.push({
        player_id: player.player_id,
        player_name: player.player_name,
        player_type: 'Football Player',
        team_id: player.team_id,
        team_name: player.team_name,
        contract: `${player.contract_start_season} → ${player.contract_end_season}`,
        action: 'Contract expired naturally'
      });
    }

    const summary = {
      newSeason: newSeasonId,
      teamsReRegistered: registeredTeams.length,
      playersToRelease: playersToRelease.length,
      playersToKeep: playersToKeep.length,
      playersWithExpiredContracts: playersWithExpiredContracts.length,
      totalPlayersAffected: playersToRelease.length + playersWithExpiredContracts.length
    };

    console.log('📊 Summary:', summary);

    // If preview mode, return the analysis
    if (action === 'preview') {
      return NextResponse.json({
        success: true,
        mode: 'preview',
        summary,
        details: {
          playersToRelease,
          playersToKeep,
          playersWithExpiredContracts
        },
        message: `Preview: ${summary.totalPlayersAffected} players will be affected. Use action='execute' to apply changes.`
      });
    }

    // EXECUTE MODE: Apply the changes
    if (action === 'execute') {
      let updatedCount = 0;
      let releasedCount = 0;
      const errors: string[] = [];

      // Process players to release (team didn't re-register)
      for (const player of playersToRelease) {
        try {
          if (player.player_type === 'Real Player') {
            // Update real player in tournament DB
            await tournamentSql`
              UPDATE player_seasons
              SET 
                contract_end_season = ${previousSeasonId},
                updated_at = NOW()
              WHERE 
                player_id = ${player.player_id}
                AND season_id = ${previousSeasonId}
            `;

            // Check if player has a record in new season
            const newSeasonRecord = await tournamentSql`
              SELECT id FROM player_seasons
              WHERE player_id = ${player.player_id}
                AND season_id = ${newSeasonId}
              LIMIT 1
            `;

            if (newSeasonRecord.length > 0) {
              await tournamentSql`
                UPDATE player_seasons
                SET 
                  team_id = NULL,
                  team = NULL,
                  updated_at = NOW()
                WHERE 
                  player_id = ${player.player_id}
                  AND season_id = ${newSeasonId}
              `;
              releasedCount++;
            }
          } else if (player.player_type === 'Football Player') {
            // Update football player in auction DB
            await auctionSql`
              UPDATE footballplayers
              SET 
                contract_end_season = ${previousSeasonId},
                status = 'free_agent',
                updated_at = NOW()
              WHERE 
                player_id = ${player.player_id}
                AND season_id = ${previousSeasonId}
            `;

            // Check if player exists in new season
            const newSeasonRecord = await auctionSql`
              SELECT id FROM footballplayers
              WHERE player_id = ${player.player_id}
                AND season_id = ${newSeasonId}
              LIMIT 1
            `;

            if (newSeasonRecord.length > 0) {
              await auctionSql`
                UPDATE footballplayers
                SET 
                  team_id = NULL,
                  team_name = NULL,
                  status = 'free_agent',
                  updated_at = NOW()
                WHERE 
                  player_id = ${player.player_id}
                  AND season_id = ${newSeasonId}
              `;
              releasedCount++;
            }
          }

          updatedCount++;
          console.log(`✅ Released ${player.player_name} (${player.player_type}) from ${player.team_name}`);
        } catch (error) {
          const errorMsg = `Failed to release ${player.player_name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      // Process players with expired contracts
      for (const player of playersWithExpiredContracts) {
        try {
          if (player.player_type === 'Real Player') {
            const newSeasonRecord = await tournamentSql`
              SELECT id FROM player_seasons
              WHERE player_id = ${player.player_id}
                AND season_id = ${newSeasonId}
              LIMIT 1
            `;

            if (newSeasonRecord.length > 0) {
              await tournamentSql`
                UPDATE player_seasons
                SET 
                  team_id = NULL,
                  team = NULL,
                  updated_at = NOW()
                WHERE 
                  player_id = ${player.player_id}
                  AND season_id = ${newSeasonId}
              `;
              releasedCount++;
            }
          } else if (player.player_type === 'Football Player') {
            const newSeasonRecord = await auctionSql`
              SELECT id FROM footballplayers
              WHERE player_id = ${player.player_id}
                AND season_id = ${newSeasonId}
              LIMIT 1
            `;

            if (newSeasonRecord.length > 0) {
              await auctionSql`
                UPDATE footballplayers
                SET 
                  team_id = NULL,
                  team_name = NULL,
                  status = 'free_agent',
                  updated_at = NOW()
                WHERE 
                  player_id = ${player.player_id}
                  AND season_id = ${newSeasonId}
              `;
              releasedCount++;
            }
          }
          console.log(`✅ Released ${player.player_name} (${player.player_type}) - contract expired`);
        } catch (error) {
          const errorMsg = `Failed to release ${player.player_name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      return NextResponse.json({
        success: true,
        mode: 'execute',
        summary,
        results: {
          contractsCut: updatedCount,
          playersReleased: releasedCount,
          errors: errors.length > 0 ? errors : undefined
        },
        message: `✅ Reconciliation complete! Cut ${updatedCount} contracts and released ${releasedCount} players.`
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action. Use "preview" or "execute"' },
      { status: 400 }
    );

  } catch (error: any) {
    console.error('❌ Contract reconciliation error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to reconcile contracts',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
