import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { adminDb } from '@/lib/firebase/admin';

/**
 * POST /api/players/release-real-player
 * Release a real player with mid-season support and manual refund percentage
 * 
 * Body:
 * {
 *   playerId: string,           // player_id from player_seasons
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

        const sql = getTournamentDb();

        // Fetch player details
        const players = await sql`
      SELECT 
        id,
        player_id,
        player_name,
        team_id,
        team,
        auction_value,
        contract_start_season,
        contract_end_season,
        contract_id
      FROM player_seasons
      WHERE player_id = ${playerId} AND season_id = ${seasonId}
    `;

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

        if (!player.auction_value || !player.contract_start_season || !player.contract_end_season) {
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
        const refundAmount = Math.round(player.auction_value * (refundPercentage / 100));

        // Calculate half-seasons for logging purposes
        const startSeasonNum = parseFloat(player.contract_start_season.replace(/\D/g, '').replace(/(\d+)\.(\d+)/, '$1.$2'));
        const endSeasonNum = parseFloat(player.contract_end_season.replace(/\D/g, '').replace(/(\d+)\.(\d+)/, '$1.$2'));
        const releaseSeasonNum = parseFloat(releaseSeasonNumber + (releaseTiming === 'mid' ? '.5' : '.0'));

        const totalHalfSeasons = (endSeasonNum - startSeasonNum) * 2;
        const elapsedHalfSeasons = (releaseSeasonNum - startSeasonNum) * 2;
        const remainingHalfSeasons = totalHalfSeasons - elapsedHalfSeasons;

        // Fetch team details from teamstats
        const teams = await sql`
      SELECT id, team_name, team_id
      FROM teamstats
      WHERE team_id = ${player.team_id} AND season_id = ${seasonId}
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
        // 1. Update current season player record - end contract at release point
        await sql`
      UPDATE player_seasons
      SET 
        team_id = NULL,
        team = NULL,
        status = NULL,
        contract_end_season = ${releaseSeasonId},
        updated_at = NOW()
      WHERE player_id = ${playerId} AND season_id = ${seasonId}
    `;

        // 2. Create new free agent contract with modified season_id to avoid unique constraint
        // For mid-season release: use SSPSLS16.5 as season_id
        // For start release: use SSPSLS16.0 as season_id
        const freeAgentSeasonId = releaseTiming === 'mid'
            ? `SSPSLS${releaseSeasonNumber}.5`
            : `SSPSLS${releaseSeasonNumber}.0`;

        const seasonEndId = `SSPSLS${parseInt(releaseSeasonNumber) + 1}`;
        const originalPlayer = await sql`
      SELECT * FROM player_seasons
      WHERE player_id = ${playerId} AND season_id = ${seasonId}
      LIMIT 1
    `;

        if (originalPlayer.length > 0) {
            const playerData = originalPlayer[0];

            await sql`
        INSERT INTO player_seasons (
          id,
          player_id,
          player_name,
          season_id,
          team_id,
          team,
          contract_start_season,
          contract_end_season,
          auction_value,
          star_rating,
          category,
          registration_status,
          status,
          created_at,
          updated_at
        ) VALUES (
          ${`${playerId}_${freeAgentSeasonId}`},
          ${playerId},
          ${playerData.player_name},
          ${freeAgentSeasonId},
          NULL,
          NULL,
          ${releaseSeasonId},
          ${seasonEndId},
          NULL,
          ${playerData.star_rating},
          ${playerData.category},
          'free_agent',
          NULL,
          NOW(),
          NOW()
        )
      `;
        }

        // 3. Update future season contracts to free agent
        const currentSeasonNum = parseInt(releaseSeasonNumber);
        await sql`
      UPDATE player_seasons
      SET 
        team_id = NULL,
        team = NULL,
        status = NULL,
        auction_value = NULL,
        registration_status = 'free_agent',
        updated_at = NOW()
      WHERE player_id = ${playerId}
        AND CAST(REGEXP_REPLACE(season_id, '[^0-9.]', '', 'g') AS DECIMAL) > ${currentSeasonNum}
    `;

        // 4. Update team balance in Firebase team_seasons
        try {
            const teamSeasonDocId = `${player.team_id}_${seasonId}`;
            const teamSeasonDoc = await adminDb.collection('team_seasons').doc(teamSeasonDocId).get();

            if (teamSeasonDoc.exists) {
                const teamSeasonData = teamSeasonDoc.data();
                const currentBalance = teamSeasonData?.real_player_budget || 0;
                const newBalance = currentBalance + refundAmount;

                await adminDb.collection('team_seasons').doc(teamSeasonDocId).update({
                    real_player_budget: newBalance,
                    updated_at: new Date()
                });

                console.log(`✅ Updated team balance: ${currentBalance} → ${newBalance} (+$${refundAmount})`);
            } else {
                console.warn(`⚠️  Team season document not found: ${teamSeasonDocId}`);
            }
        } catch (firebaseError) {
            console.error('Error updating Firebase team balance:', firebaseError);
            // Continue even if Firebase update fails
        }

        // 5. Log the transaction in Firebase
        await adminDb.collection('transactions').add({
            transaction_type: 'release',
            player_id: playerId,
            player_name: player.player_name,
            player_type: 'real',
            team_id: player.team_id,
            team_name: team.team_name,
            season_id: seasonId,
            release_timing: releaseTiming,
            release_season: releaseSeasonId,
            refund_amount: refundAmount,
            refund_percentage: refundPercentage,
            auction_value: player.auction_value,
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
                    auction_value: player.auction_value
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
        console.error('Error in release-real-player API:', error);
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
