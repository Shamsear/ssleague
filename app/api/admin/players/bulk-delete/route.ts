import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * POST /api/admin/players/bulk-delete
 * Delete multiple player registrations at once with auto-promotion
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { player_ids, season_id } = body;

    if (!player_ids || !Array.isArray(player_ids) || player_ids.length === 0 || !season_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: player_ids (array) and season_id' },
        { status: 400 }
      );
    }

    const sql = getTournamentDb();
    
    // Calculate next season for 2-season contracts
    const seasonNumber = parseInt(season_id.replace(/\D/g, ''));
    const seasonPrefix = season_id.replace(/\d+$/, '');
    const nextSeasonId = `${seasonPrefix}${seasonNumber + 1}`;

    const deletedPlayers: any[] = [];
    const promotedPlayers: any[] = [];
    let confirmedDeletedCount = 0;

    console.log(`🗑️ Bulk deleting ${player_ids.length} players from season ${season_id}`);

    for (const player_id of player_ids) {
      const currentRegistrationId = `${player_id}_${season_id}`;
      const nextRegistrationId = `${player_id}_${nextSeasonId}`;

      // Get player data
      const playerSeasons = await sql`
        SELECT id, player_name, registration_type
        FROM player_seasons 
        WHERE id IN (${currentRegistrationId}, ${nextRegistrationId})
      `;

      if (playerSeasons.length === 0) {
        console.warn(`⚠️ Player ${player_id} not found, skipping`);
        continue;
      }

      const currentSeasonData = playerSeasons.find((ps: any) => ps.id === currentRegistrationId);
      const registrationType = currentSeasonData?.registration_type || 'confirmed';
      const playerName = currentSeasonData?.player_name || player_id;

      // Delete from Neon
      await sql`
        DELETE FROM player_seasons 
        WHERE id IN (${currentRegistrationId}, ${nextRegistrationId})
      `;

      // Delete from Firebase
      try {
        await adminDb.collection('realplayer').doc(currentRegistrationId).delete();
        await adminDb.collection('realplayer').doc(nextRegistrationId).delete();
      } catch (fbError) {
        console.warn('Firebase deletion failed (may not exist):', fbError);
      }

      // Remove from fantasy league
      try {
        const fantasyLeagues = await fantasySql`
          SELECT league_id
          FROM fantasy_leagues
          WHERE season_id = ${season_id}
          LIMIT 1
        `;

        if (fantasyLeagues.length > 0) {
          const leagueId = fantasyLeagues[0].league_id;
          await fantasySql`
            DELETE FROM fantasy_players
            WHERE player_id = ${player_id} AND league_id = ${leagueId}
          `;
        }
      } catch (fantasyError) {
        console.warn('Fantasy removal failed:', fantasyError);
      }

      // Update master realplayers
      try {
        const playersQuery = await adminDb
          .collection('realplayers')
          .where('player_id', '==', player_id)
          .limit(1)
          .get();

        if (!playersQuery.empty) {
          await playersQuery.docs[0].ref.update({
            is_registered: false,
            current_season_id: null,
            registration_date: null,
          });
        }
      } catch (updateError) {
        console.warn('Master realplayers update failed:', updateError);
      }

      deletedPlayers.push({
        player_id,
        player_name: playerName,
        registration_type: registrationType,
      });

      if (registrationType === 'confirmed') {
        confirmedDeletedCount++;
      }

      console.log(`✅ Deleted player ${playerName} (${registrationType})`);
    }

    // Auto-promote unconfirmed players for each deleted confirmed player
    if (confirmedDeletedCount > 0) {
      const seasonDoc = await adminDb.collection('seasons').doc(season_id).get();
      if (seasonDoc.exists) {
        const seasonData = seasonDoc.data()!;
        const currentFilled = seasonData.confirmed_slots_filled || 0;
        const confirmedLimit = seasonData.confirmed_slots_limit || 999;

        // Decrement counter
        const newFilled = Math.max(0, currentFilled - confirmedDeletedCount);
        await adminDb.collection('seasons').doc(season_id).update({
          confirmed_slots_filled: newFilled,
        });

        // Check if we can promote players
        if (newFilled < confirmedLimit) {
          const slotsToFill = Math.min(confirmedDeletedCount, confirmedLimit - newFilled);

          // Get oldest unconfirmed players
          const unconfirmedPlayers = await sql`
            SELECT id, player_id, player_name, registration_date
            FROM player_seasons
            WHERE season_id = ${season_id}
              AND registration_type = 'unconfirmed'
            ORDER BY registration_date ASC
            LIMIT ${slotsToFill}
          `;

          // Promote them
          for (const player of unconfirmedPlayers) {
            await sql`
              UPDATE player_seasons
              SET registration_type = 'confirmed',
                  updated_at = NOW()
              WHERE id = ${player.id}
            `;

            promotedPlayers.push({
              player_id: player.player_id,
              player_name: player.player_name,
              registration_date: player.registration_date,
            });

            console.log(`✅ Auto-promoted ${player.player_name} from unconfirmed to confirmed`);
          }

          // Update counter with promoted players
          await adminDb.collection('seasons').doc(season_id).update({
            confirmed_slots_filled: newFilled + promotedPlayers.length,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${deletedPlayers.length} players${
        promotedPlayers.length > 0 ? ` and auto-promoted ${promotedPlayers.length} players` : ''
      }`,
      data: {
        deleted_count: deletedPlayers.length,
        deleted_players: deletedPlayers,
        promoted_count: promotedPlayers.length,
        promoted_players: promotedPlayers,
      },
    });
  } catch (error: any) {
    console.error('Error bulk deleting players:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to bulk delete players',
      },
      { status: 500 }
    );
  }
}
