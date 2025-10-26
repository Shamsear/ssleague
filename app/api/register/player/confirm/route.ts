import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * POST /api/register/player/confirm
 * Confirm player self-registration
 * Uses Admin SDK to bypass security rules
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields (user_email and user_uid are optional for committee registrations)
    if (!body.player_id || !body.season_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: player_id and season_id are required',
        },
        { status: 400 }
      );
    }

    const { player_id, season_id, user_email, user_uid, player_data } = body;

    // Check if player already registered for this season in Neon
    const sql = getTournamentDb();
    const registrationId = `${player_id}_${season_id}`;
    
    const existingRegistration = await sql`
      SELECT id FROM player_seasons WHERE id = ${registrationId}
    `;

    if (existingRegistration.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Player is already registered for this season',
        },
        { status: 400 }
      );
    }

    // Calculate next season ID (e.g., SSPSLS16 -> SSPSLS17)
    const seasonNumber = parseInt(season_id.replace(/\D/g, ''));
    const seasonPrefix = season_id.replace(/\d+$/, '');
    const nextSeasonId = `${seasonPrefix}${seasonNumber + 1}`;
    const nextRegistrationId = `${player_id}_${nextSeasonId}`;
    
    // Generate unique contract ID
    const contractId = `contract_${player_id}_${season_id}_${Date.now()}`;
    
    console.log(`📝 Creating 2-season contract for ${player_id}: ${season_id} & ${nextSeasonId}`);

    // Create registration for CURRENT season in Neon player_seasons table
    await sql`
      INSERT INTO player_seasons (
        id, player_id, season_id, player_name,
        contract_id, contract_start_season, contract_end_season, contract_length,
        is_auto_registered, registration_date,
        star_rating, points,
        matches_played, goals_scored, assists, wins, draws, losses, clean_sheets, motm_awards,
        created_at, updated_at
      )
      VALUES (
        ${registrationId}, ${player_id}, ${season_id}, ${player_data?.name || ''},
        ${contractId}, ${season_id}, ${nextSeasonId}, 2,
        false, NOW(),
        3, 100,
        0, 0, 0, 0, 0, 0, 0, 0,
        NOW(), NOW()
      )
    `;
    
    // Create registration for NEXT season (auto-registered as part of contract)
    await sql`
      INSERT INTO player_seasons (
        id, player_id, season_id, player_name,
        contract_id, contract_start_season, contract_end_season, contract_length,
        is_auto_registered, registration_date,
        star_rating, points,
        matches_played, goals_scored, assists, wins, draws, losses, clean_sheets, motm_awards,
        created_at, updated_at
      )
      VALUES (
        ${nextRegistrationId}, ${player_id}, ${nextSeasonId}, ${player_data?.name || ''},
        ${contractId}, ${season_id}, ${nextSeasonId}, 2,
        true, NOW(),
        3, 100,
        0, 0, 0, 0, 0, 0, 0, 0,
        NOW(), NOW()
      )
    `;
    
    console.log(`✅ Created contract ${contractId} for ${player_id}: ${registrationId} & ${nextRegistrationId}`);

    // Auto-add player to fantasy league if one exists for this season
    try {
      const fantasyLeagues = await fantasySql`
        SELECT league_id, star_rating_prices
        FROM fantasy_leagues
        WHERE season_id = ${season_id}
        LIMIT 1
      `;

      if (fantasyLeagues.length > 0) {
        const league = fantasyLeagues[0];
        const starRating = 5; // Default star rating
        
        // Get price from star rating pricing
        let draftPrice = 10; // Default price
        if (league.star_rating_prices) {
          const priceObj = league.star_rating_prices.find((p: any) => p.stars === starRating);
          if (priceObj) draftPrice = priceObj.price;
        }

        await fantasySql`
          INSERT INTO fantasy_players (
            player_id,
            league_id,
            player_name,
            real_team_id,
            real_team_name,
            position,
            star_rating,
            draft_price,
            is_available
          ) VALUES (
            ${player_id},
            ${league.league_id},
            ${player_data?.name || ''},
            '',
            '',
            'Unknown',
            ${starRating},
            ${draftPrice},
            true
          )
          ON CONFLICT (player_id, league_id) DO NOTHING
        `;

        console.log(`✅ Added ${player_data?.name || player_id} to fantasy league ${league.league_id}`);
      }
    } catch (fantasyError) {
      // Don't fail registration if fantasy addition fails
      console.error('Warning: Failed to add player to fantasy league:', fantasyError);
    }

    // Update permanent player data in Firebase realplayers collection
    const playersQuery = await adminDb
      .collection('realplayers')
      .where('player_id', '==', player_id)
      .limit(1)
      .get();

    if (!playersQuery.empty) {
      const playerDoc = playersQuery.docs[0];
      const updateData: any = {
        current_season_id: season_id,
        registration_date: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      };

      // Update any missing player data if provided
      if (player_data) {
        if (player_data.name) updateData.name = player_data.name;
        if (player_data.place) updateData.place = player_data.place;
        if (player_data.date_of_birth) updateData.date_of_birth = player_data.date_of_birth;
        if (player_data.email) updateData.email = player_data.email;
        if (player_data.phone) updateData.phone = player_data.phone;
      }

      await playerDoc.ref.update(updateData);
    } else {
      // Player doesn't exist in master list, create them
      if (!player_data || !player_data.name) {
        return NextResponse.json(
          {
            success: false,
            error: 'Player data is required for new players',
          },
          { status: 400 }
        );
      }

      // Generate new player ID if this is a completely new player
      const newPlayerId = player_id;
      
      await adminDb.collection('realplayers').doc(newPlayerId).set({
        player_id: newPlayerId,
        name: player_data.name,
        place: player_data.place || null,
        date_of_birth: player_data.date_of_birth || null,
        email: player_data.email || null,
        phone: player_data.phone || null,
        is_registered: true,
        season_id,
        registered_email: user_email,
        registered_user_id: user_uid,
        is_active: true,
        is_available: true,
        role: 'player',
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Player registration confirmed successfully (2-season contract)',
        data: {
          player_id,
          season_id,
          next_season_id: nextSeasonId,
          registration_id: registrationId,
          next_registration_id: nextRegistrationId,
          contract_id: contractId,
          contract_seasons: [season_id, nextSeasonId],
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error confirming player registration:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to confirm registration',
      },
      { status: 500 }
    );
  }
}
