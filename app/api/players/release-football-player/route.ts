import { NextRequest, NextResponse } from 'next/server';
import { getAuctionDb } from '@/lib/neon/auction-config';
import { adminDb } from '@/lib/firebase/admin';
import { closePlayerHistory } from '@/lib/player-history';

/**
 * POST /api/players/release-football-player
 * Release a football player with mid-season support and manual refund percentage
 * 
 * Body:
 * {
 *   playerId: string,           // player_id from footballplayers
 *   seasonId: string,           // current season (e.g., "sspsls16")
 *   releaseTiming: 'start' | 'mid', // when to release
 *   refundPercentage: number,   // Manual refund percentage (0-100)
 *   releasedBy: string,         // admin UID
 *   releasedByName: string      // admin name
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            playerId,
            seasonId,
            releaseTiming,
            refundPercentage,
            releasedBy,
            releasedByName
        } = body;

        // Validate required fields
        if (!playerId || !seasonId || !releaseTiming || refundPercentage === undefined || !releasedBy || !releasedByName) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Missing required fields',
                    errorCode: 'MISSING_FIELDS'
                },
                { status: 400 }
            );
        }

        if (!['start', 'mid'].includes(releaseTiming)) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Invalid release timing. Must be "start" or "mid"',
                    errorCode: 'INVALID_TIMING'
                },
                { status: 400 }
            );
        }

        if (typeof refundPercentage !== 'number' || refundPercentage < 0 || refundPercentage > 100) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Invalid refundPercentage. Must be a number between 0 and 100',
                    errorCode: 'INVALID_REFUND_PERCENTAGE'
                },
                { status: 400 }
            );
        }

        const sql = getAuctionDb();

        // Fetch player details - try with season_id first, then without
        let players = await sql`
      SELECT 
        id,
        player_id,
        name as player_name,
        team_id,
        acquisition_value,
        contract_start_season,
        contract_end_season,
        contract_id,
        season_id
      FROM footballplayers
      WHERE player_id = ${playerId} AND season_id = ${seasonId}
    `;

        // If not found with season_id, try without season_id
        if (players.length === 0) {
            players = await sql`
        SELECT 
          id,
          player_id,
          name as player_name,
          team_id,
          acquisition_value,
          contract_start_season,
          contract_end_season,
          contract_id,
          season_id
        FROM footballplayers
        WHERE player_id = ${playerId} AND team_id IS NOT NULL
        ORDER BY updated_at DESC
        LIMIT 1
      `;
        }

        if (players.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Player not found',
                    errorCode: 'PLAYER_NOT_FOUND'
                },
                { status: 404 }
            );
        }

        const player = players[0];

        if (!player.team_id) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Player is already a free agent',
                    errorCode: 'ALREADY_FREE_AGENT'
                },
                { status: 400 }
            );
        }

        if (!player.acquisition_value || !player.contract_start_season || !player.contract_end_season) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Player contract information is incomplete',
                    errorCode: 'INCOMPLETE_CONTRACT'
                },
                { status: 400 }
            );
        }

        // Calculate release season (uppercase)
        const releaseSeasonNumber = seasonId.replace(/\D/g, '');
        const releaseSeasonId = releaseTiming === 'mid'
            ? `SSPSLS${releaseSeasonNumber}.5`
            : seasonId.toUpperCase();

        // Calculate refund amount using manual percentage
        const refundAmount = Math.round(player.acquisition_value * (refundPercentage / 100));

        // Calculate half-seasons for logging purposes
        const startSeasonNum = parseFloat(player.contract_start_season.replace(/\D/g, '').replace(/(\d+)\.(\d+)/, '$1.$2'));
        const endSeasonNum = parseFloat(player.contract_end_season.replace(/\D/g, '').replace(/(\d+)\.(\d+)/, '$1.$2'));
        const releaseSeasonNum = parseFloat(releaseSeasonNumber + (releaseTiming === 'mid' ? '.5' : '.0'));

        const totalHalfSeasons = (endSeasonNum - startSeasonNum) * 2;
        const elapsedHalfSeasons = (releaseSeasonNum - startSeasonNum) * 2;
        const remainingHalfSeasons = totalHalfSeasons - elapsedHalfSeasons;

        // Fetch team details from teams table
        const teams = await sql`
      SELECT id, name as team_name
      FROM teams
      WHERE id = ${player.team_id}
    `;

        if (teams.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Team not found',
                    errorCode: 'TEAM_NOT_FOUND'
                },
                { status: 404 }
            );
        }

        const team = teams[0];

        // Execute database updates
        // 1. Update footballplayers table - release player and end contract at release point
        const playerSeasonId = player.season_id || seasonId;
        await sql`
      UPDATE footballplayers
      SET 
        team_id = NULL,
        status = 'free_agent',
        is_sold = false,
        contract_end_season = ${releaseSeasonId},
        season_id = NULL,
        updated_at = NOW()
      WHERE player_id = ${playerId} AND (season_id = ${playerSeasonId} OR (season_id IS NULL AND id = ${player.id}))
    `;

        // 2. Close player_history record
        try {
            await closePlayerHistory(
                playerId,
                player.team_id,
                'release',
                releaseSeasonId
            );
            console.log(`✅ Closed player_history for ${player.player_name}`);
        } catch (historyError) {
            console.error('Error closing player_history:', historyError);
            // Continue even if player_history update fails
        }

        // 3. Remove from team_players table if exists
        try {
            await sql`
        DELETE FROM team_players
        WHERE player_id = ${player.id}
      `;
            console.log(`✅ Removed from team_players table`);
        } catch (teamPlayerError) {
            console.warn('Could not delete from team_players:', teamPlayerError);
        }

        // 4. Update team balance in Firebase team_seasons
        try {
            const teamSeasonDocId = `${player.team_id}_${seasonId}`;
            const teamSeasonDoc = await adminDb.collection('team_seasons').doc(teamSeasonDocId).get();

            if (teamSeasonDoc.exists) {
                const teamSeasonData = teamSeasonDoc.data();
                const currentBalance = teamSeasonData?.football_budget || 0;
                const newBalance = currentBalance + refundAmount;

                await adminDb.collection('team_seasons').doc(teamSeasonDocId).update({
                    football_budget: newBalance,
                    updated_at: new Date()
                });

                console.log(`✅ Updated Firebase team_seasons balance: ${currentBalance} → ${newBalance} (+${refundAmount})`);
            } else {
                console.warn(`⚠️  Team season document not found: ${teamSeasonDocId}`);
            }
        } catch (firebaseError) {
            console.error('Error updating Firebase team balance:', firebaseError);
            // Continue even if Firebase update fails
        }

        // 5. Update team balance in Neon teams table (auction DB)
        try {
            await sql`
                UPDATE teams
                SET 
                    football_budget = football_budget + ${refundAmount},
                    updated_at = NOW()
                WHERE id = ${player.team_id}
            `;
            console.log(`✅ Updated Neon teams table football_budget (+${refundAmount})`);
        } catch (neonError) {
            console.error('Error updating Neon teams table:', neonError);
            // Continue even if Neon update fails
        }

        // 6. Log the transaction in Firebase
        await adminDb.collection('transactions').add({
            transaction_type: 'release',
            player_id: playerId,
            player_name: player.player_name,
            player_type: 'football',
            team_id: player.team_id,
            team_name: team.team_name,
            season_id: seasonId,
            release_timing: releaseTiming,
            release_season: releaseSeasonId,
            refund_amount: refundAmount,
            refund_percentage: refundPercentage,
            acquisition_value: player.acquisition_value,
            original_contract_start: player.contract_start_season,
            original_contract_end: player.contract_end_season,
            total_half_seasons: totalHalfSeasons,
            elapsed_half_seasons: elapsedHalfSeasons,
            remaining_half_seasons: remainingHalfSeasons,
            processed_by: releasedBy,
            processed_by_name: releasedByName,
            created_at: new Date()
        });

        return NextResponse.json({
            success: true,
            message: `${player.player_name} released successfully`,
            data: {
                player_name: player.player_name,
                player_id: playerId,
                old_team: team.team_name,
                release_season: releaseSeasonId,
                release_timing: releaseTiming,
                contract_info: {
                    original_start: player.contract_start_season,
                    original_end: player.contract_end_season,
                    new_end: releaseSeasonId,
                    acquisition_value: player.acquisition_value
                },
                refund_info: {
                    total_half_seasons: totalHalfSeasons,
                    elapsed_half_seasons: elapsedHalfSeasons,
                    remaining_half_seasons: remainingHalfSeasons,
                    refund_percentage: refundPercentage + '%',
                    refund_amount: refundAmount
                }
            }
        });

    } catch (error: any) {
        console.error('Error in release-football-player API:', error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Failed to release player',
                errorCode: 'SYSTEM_ERROR'
            },
            { status: 500 }
        );
    }
}
