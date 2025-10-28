import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * DELETE /api/register/player/delete
 * Delete player registration from all databases (Neon player_seasons, Firebase, Fantasy)
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.player_id || !body.season_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: player_id and season_id are required',
        },
        { status: 400 }
      );
    }

    const { player_id, season_id } = body;

    // Calculate next season ID for 2-season contract
    const seasonNumber = parseInt(season_id.replace(/\D/g, ''));
    const seasonPrefix = season_id.replace(/\d+$/, '');
    const nextSeasonId = `${seasonPrefix}${seasonNumber + 1}`;

    const currentRegistrationId = `${player_id}_${season_id}`;
    const nextRegistrationId = `${player_id}_${nextSeasonId}`;

    console.log(`🗑️ Deleting player registration: ${currentRegistrationId} and ${nextRegistrationId}`);

    // Get the player data from Neon to check team assignment and get registration type
    const sql = getTournamentDb();
    const playerSeasons = await sql`
      SELECT id, registration_type, contract_id
      FROM player_seasons 
      WHERE id IN (${currentRegistrationId}, ${nextRegistrationId})
    `;

    if (playerSeasons.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Player registration not found',
        },
        { status: 404 }
      );
    }

    const currentSeasonData = playerSeasons.find((ps: any) => ps.id === currentRegistrationId);
    const registrationType = currentSeasonData?.registration_type || 'confirmed';

    // Delete from Neon player_seasons table (both current and next season)
    await sql`
      DELETE FROM player_seasons 
      WHERE id IN (${currentRegistrationId}, ${nextRegistrationId})
    `;

    console.log(`✅ Deleted from Neon player_seasons: ${currentRegistrationId}, ${nextRegistrationId}`);

    // Delete from Firebase realplayer collection (both seasons)
    try {
      const firestoreDb = adminDb;
      await firestoreDb.collection('realplayer').doc(currentRegistrationId).delete();
      console.log(`✅ Deleted from Firebase realplayer: ${currentRegistrationId}`);
    } catch (fbError) {
      console.warn('Firebase realplayer deletion failed (may not exist):', fbError);
    }

    try {
      await adminDb.collection('realplayer').doc(nextRegistrationId).delete();
      console.log(`✅ Deleted from Firebase realplayer: ${nextRegistrationId}`);
    } catch (fbError) {
      console.warn('Firebase next season realplayer deletion failed (may not exist):', fbError);
    }

    // Decrement confirmed_slots_filled counter if this was a confirmed registration
    if (registrationType === 'confirmed') {
      const seasonDoc = await adminDb.collection('seasons').doc(season_id).get();
      if (seasonDoc.exists) {
        const currentFilled = seasonDoc.data()?.confirmed_slots_filled || 0;
        if (currentFilled > 0) {
          await adminDb.collection('seasons').doc(season_id).update({
            confirmed_slots_filled: currentFilled - 1,
          });
          console.log(`✅ Decremented confirmed_slots_filled for season ${season_id}`);
        }
      }
    }

    // Remove from fantasy league if exists
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
        console.log(`✅ Removed from fantasy league ${leagueId}`);
      }
    } catch (fantasyError) {
      console.warn('Fantasy league removal failed (may not exist):', fantasyError);
    }

    // Update master realplayers collection status
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
        console.log(`✅ Updated realplayers master collection`);
      }
    } catch (updateError) {
      console.warn('Master realplayers update failed:', updateError);
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Player registration deleted successfully (both seasons removed)',
        data: {
          player_id,
          season_id,
          next_season_id: nextSeasonId,
          deleted_registrations: [currentRegistrationId, nextRegistrationId],
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error deleting player registration:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to delete registration',
      },
      { status: 500 }
    );
  }
}
