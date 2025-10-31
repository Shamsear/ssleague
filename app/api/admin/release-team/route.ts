/**
 * Mid-Season Team Release API
 * 
 * Purpose: When a team leaves/drops out mid-season, this releases ALL their players
 * (both SS Members and Football Players) immediately so they can be used in auctions.
 * 
 * Example:
 * - Team Azzuri FC leaves during S17
 * - All their SS Members → released to free agent pool
 * - All their Football Players → released to auction pool
 * - Contract end dates are updated to current season
 * 
 * This is different from contract reconciliation which happens at season transitions.
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
      teamId,        // e.g., 'team_abc123'
      seasonId,      // e.g., 'SSPSLS17'
      reason = '',   // Optional reason for release
      action = 'preview' // 'preview' or 'execute'
    } = body;

    if (!teamId || !seasonId) {
      return NextResponse.json(
        { success: false, error: 'teamId and seasonId are required' },
        { status: 400 }
      );
    }

    console.log(`🔓 Mid-Season Team Release: ${teamId} from ${seasonId}`);

    // Step 1: Find all Real Players (SS Members) on this team
    const realPlayers = await tournamentSql`
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
      WHERE season_id = ${seasonId}
        AND team_id = ${teamId}
      ORDER BY player_name
    `;

    console.log(`📋 Found ${realPlayers.length} SS Members on team`);

    // Step 2: Find all Football Players on this team
    const footballPlayers = await auctionSql`
      SELECT 
        player_id,
        name as player_name,
        season_id,
        team_id,
        team_name,
        contract_start_season,
        contract_end_season,
        acquisition_value,
        position
      FROM footballplayers
      WHERE season_id = ${seasonId}
        AND team_id = ${teamId}
      ORDER BY name
    `;

    console.log(`📋 Found ${footballPlayers.length} Football Players on team`);

    // Prepare release list
    const playersToRelease = [
      ...realPlayers.map(p => ({
        player_id: p.player_id,
        player_name: p.player_name,
        player_type: 'Real Player',
        contract_original: p.contract_end_season 
          ? `${p.contract_start_season} → ${p.contract_end_season}`
          : 'No contract',
        contract_cut_to: `${p.contract_start_season} → ${seasonId}`,
        action: 'Release mid-season'
      })),
      ...footballPlayers.map(p => ({
        player_id: p.player_id,
        player_name: p.player_name,
        player_type: 'Football Player',
        position: p.position,
        contract_original: p.contract_end_season 
          ? `${p.contract_start_season} → ${p.contract_end_season}`
          : 'No contract',
        contract_cut_to: `${p.contract_start_season} → ${seasonId}`,
        action: 'Release mid-season'
      }))
    ];

    const summary = {
      teamId,
      seasonId,
      reason,
      totalPlayers: playersToRelease.length,
      realPlayers: realPlayers.length,
      footballPlayers: footballPlayers.length
    };

    // If preview mode, return the analysis
    if (action === 'preview') {
      return NextResponse.json({
        success: true,
        mode: 'preview',
        summary,
        playersToRelease,
        message: `Preview: ${playersToRelease.length} players will be released. Use action='execute' to apply changes.`
      });
    }

    // EXECUTE MODE: Release all players
    if (action === 'execute') {
      let releasedRealPlayers = 0;
      let releasedFootballPlayers = 0;
      const errors: string[] = [];

      // Release Real Players (SS Members)
      for (const player of realPlayers) {
        try {
          await tournamentSql`
            UPDATE player_seasons
            SET 
              team_id = NULL,
              team = NULL,
              contract_end_season = ${seasonId},
              updated_at = NOW()
            WHERE 
              player_id = ${player.player_id}
              AND season_id = ${seasonId}
          `;
          releasedRealPlayers++;
          console.log(`✅ Released SS Member: ${player.player_name}`);
        } catch (error) {
          const errorMsg = `Failed to release ${player.player_name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      // Release Football Players
      for (const player of footballPlayers) {
        try {
          await auctionSql`
            UPDATE footballplayers
            SET 
              team_id = NULL,
              team_name = NULL,
              contract_end_season = ${seasonId},
              status = 'free_agent',
              is_auction_eligible = true,
              updated_at = NOW()
            WHERE 
              player_id = ${player.player_id}
              AND season_id = ${seasonId}
          `;
          releasedFootballPlayers++;
          console.log(`✅ Released Football Player: ${player.player_name}`);
        } catch (error) {
          const errorMsg = `Failed to release ${player.player_name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      // Update team status (optional - mark team as withdrawn)
      try {
        await tournamentSql`
          UPDATE team_seasons
          SET 
            status = 'withdrawn',
            updated_at = NOW()
          WHERE 
            team_id = ${teamId}
            AND season_id = ${seasonId}
        `;
        console.log(`✅ Marked team as withdrawn`);
      } catch (error) {
        console.error('Failed to update team status:', error);
      }

      return NextResponse.json({
        success: true,
        mode: 'execute',
        summary,
        results: {
          realPlayersReleased: releasedRealPlayers,
          footballPlayersReleased: releasedFootballPlayers,
          totalReleased: releasedRealPlayers + releasedFootballPlayers,
          errors: errors.length > 0 ? errors : undefined
        },
        message: `✅ Released ${releasedRealPlayers} SS Members and ${releasedFootballPlayers} Football Players!`
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action. Use "preview" or "execute"' },
      { status: 400 }
    );

  } catch (error: any) {
    console.error('❌ Mid-season release error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to release team',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
