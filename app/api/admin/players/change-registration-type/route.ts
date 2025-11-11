import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getTournamentDb } from '@/lib/neon/tournament-config';

/**
 * POST /api/admin/players/change-registration-type
 * Manually promote or demote a player's registration type
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { player_id, season_id, new_type } = body;

    if (!player_id || !season_id || !new_type) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: player_id, season_id, and new_type' },
        { status: 400 }
      );
    }

    if (!['confirmed', 'unconfirmed'].includes(new_type)) {
      return NextResponse.json(
        { success: false, error: 'new_type must be either "confirmed" or "unconfirmed"' },
        { status: 400 }
      );
    }

    const sql = getTournamentDb();
    const registrationId = `${player_id}_${season_id}`;

    // Get current player data
    const playerData = await sql`
      SELECT id, player_name, registration_type
      FROM player_seasons
      WHERE id = ${registrationId}
    `;

    if (playerData.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Player registration not found' },
        { status: 404 }
      );
    }

    const currentType = playerData[0].registration_type;
    const playerName = playerData[0].player_name;

    if (currentType === new_type) {
      return NextResponse.json(
        { success: false, error: `Player is already ${new_type}` },
        { status: 400 }
      );
    }

    // Get season data
    const seasonDoc = await adminDb.collection('seasons').doc(season_id).get();
    if (!seasonDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Season not found' },
        { status: 404 }
      );
    }

    const seasonData = seasonDoc.data()!;
    const currentFilled = seasonData.confirmed_slots_filled || 0;
    const confirmedLimit = seasonData.confirmed_slots_limit || 999;

    // Check if promoting to confirmed
    if (new_type === 'confirmed') {
      // Check if there's space
      if (currentFilled >= confirmedLimit) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Cannot promote: confirmed slots are full (${currentFilled}/${confirmedLimit})` 
          },
          { status: 400 }
        );
      }

      // Promote to confirmed
      await sql`
        UPDATE player_seasons
        SET registration_type = 'confirmed',
            updated_at = NOW()
        WHERE id = ${registrationId}
      `;

      // Increment counter
      await adminDb.collection('seasons').doc(season_id).update({
        confirmed_slots_filled: currentFilled + 1,
      });

      console.log(`✅ Promoted ${playerName} from unconfirmed to confirmed`);

      return NextResponse.json({
        success: true,
        message: `Successfully promoted ${playerName} to confirmed registration`,
        data: {
          player_id,
          player_name: playerName,
          previous_type: 'unconfirmed',
          new_type: 'confirmed',
          confirmed_slots_filled: currentFilled + 1,
          confirmed_slots_limit: confirmedLimit,
        },
      });
    } else {
      // Demoting to unconfirmed
      await sql`
        UPDATE player_seasons
        SET registration_type = 'unconfirmed',
            updated_at = NOW()
        WHERE id = ${registrationId}
      `;

      console.log(`✅ Demoted ${playerName} from confirmed to unconfirmed`);

      // Auto-promote next waitlist player if slots are not full
      // IMPORTANT: Exclude the player who was just demoted
      let promotedPlayer = null;
      const newFilled = Math.max(0, currentFilled - 1);
      
      if (newFilled < confirmedLimit) {
        // Get the earliest unconfirmed player (waitlist)
        // Exclude the player we just demoted to avoid immediate re-promotion
        // Also exclude players with prevent_auto_promotion flag set
        const waitlistPlayers = await sql`
          SELECT id, player_id, player_name
          FROM player_seasons
          WHERE season_id = ${season_id}
            AND registration_type = 'unconfirmed'
            AND player_id != ${player_id}
            AND COALESCE(prevent_auto_promotion, false) = false
          ORDER BY registration_date ASC
          LIMIT 1
        `;

        if (waitlistPlayers.length > 0) {
          const nextPlayer = waitlistPlayers[0];
          
          // Promote them to confirmed
          await sql`
            UPDATE player_seasons
            SET registration_type = 'confirmed',
                updated_at = NOW()
            WHERE id = ${nextPlayer.id}
          `;

          promotedPlayer = {
            player_id: nextPlayer.player_id,
            player_name: nextPlayer.player_name,
          };

          console.log(`✅ Auto-promoted ${nextPlayer.player_name} from waitlist to confirmed (excluded demoted player ${playerName})`);

          // Keep counter the same (demoted 1, promoted 1 = no change)
          await adminDb.collection('seasons').doc(season_id).update({
            confirmed_slots_filled: currentFilled,
          });
        } else {
          // No one to promote, just decrement
          await adminDb.collection('seasons').doc(season_id).update({
            confirmed_slots_filled: newFilled,
          });
        }
      } else {
        // Slots still full after demotion, just decrement
        await adminDb.collection('seasons').doc(season_id).update({
          confirmed_slots_filled: newFilled,
        });
      }

      const responseMessage = promotedPlayer
        ? `Successfully demoted ${playerName} to waitlist and auto-promoted ${promotedPlayer.player_name} to confirmed`
        : `Successfully demoted ${playerName} to unconfirmed registration`;

      return NextResponse.json({
        success: true,
        message: responseMessage,
        data: {
          demoted: {
            player_id,
            player_name: playerName,
            previous_type: 'confirmed',
            new_type: 'unconfirmed',
          },
          promoted: promotedPlayer,
          confirmed_slots_filled: promotedPlayer ? currentFilled : newFilled,
          confirmed_slots_limit: confirmedLimit,
        },
      });
    }
  } catch (error: any) {
    console.error('Error changing registration type:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to change registration type',
      },
      { status: 500 }
    );
  }
}
