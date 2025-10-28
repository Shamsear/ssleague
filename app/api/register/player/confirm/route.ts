import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { fantasySql } from '@/lib/neon/fantasy-config';
import { triggerNewsGeneration, isPlayerMilestone } from '@/lib/news/trigger';

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

    const { player_id, season_id, user_email, user_uid, player_data, is_admin_registration } = body;

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

    // Get season data to check registration phase and slot limits
    const seasonDoc = await adminDb.collection('seasons').doc(season_id).get();
    if (!seasonDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Season not found' },
        { status: 404 }
      );
    }

    const seasonData = seasonDoc.data();
    const registrationPhase = seasonData?.registration_phase || 'confirmed';
    const confirmedSlotsLimit = seasonData?.confirmed_slots_limit || 999;
    const confirmedSlotsFilled = seasonData?.confirmed_slots_filled || 0;
    const unconfirmedEnabled = seasonData?.unconfirmed_registration_enabled || false;

    // Determine registration type based on current phase and slots
    let registrationType: string;
    
    // Admin registrations always bypass slot limits and register as confirmed
    if (is_admin_registration) {
      registrationType = 'confirmed';
    } else if (registrationPhase === 'paused') {
      return NextResponse.json(
        {
          success: false,
          error: 'Registration is currently paused. Confirmed slots are filled. Please wait for admin to open unconfirmed registration.',
        },
        { status: 403 }
      );
    } else if (registrationPhase === 'closed') {
      return NextResponse.json(
        {
          success: false,
          error: 'Registration is closed for this season',
        },
        { status: 403 }
      );
    } else if (registrationPhase === 'confirmed' && confirmedSlotsFilled < confirmedSlotsLimit) {
      // Phase 1: confirmed registration with slots available
      registrationType = 'confirmed';
    } else if (registrationPhase === 'unconfirmed' && unconfirmedEnabled) {
      // Phase 2: unconfirmed registration
      registrationType = 'unconfirmed';
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Registration is not available at this time',
        },
        { status: 403 }
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
        is_auto_registered, registration_date, registration_type,
        star_rating, points,
        matches_played, goals_scored, assists, wins, draws, losses, clean_sheets, motm_awards,
        created_at, updated_at
      )
      VALUES (
        ${registrationId}, ${player_id}, ${season_id}, ${player_data?.name || ''},
        ${contractId}, ${season_id}, ${nextSeasonId}, 2,
        false, (NOW() AT TIME ZONE 'UTC')::timestamp, ${registrationType},
        3, 100,
        0, 0, 0, 0, 0, 0, 0, 0,
        (NOW() AT TIME ZONE 'UTC')::timestamp, (NOW() AT TIME ZONE 'UTC')::timestamp
      )
    `;
    
    // Create registration for NEXT season (auto-registered as part of contract)
    await sql`
      INSERT INTO player_seasons (
        id, player_id, season_id, player_name,
        contract_id, contract_start_season, contract_end_season, contract_length,
        is_auto_registered, registration_date, registration_type,
        star_rating, points,
        matches_played, goals_scored, assists, wins, draws, losses, clean_sheets, motm_awards,
        created_at, updated_at
      )
      VALUES (
        ${nextRegistrationId}, ${player_id}, ${nextSeasonId}, ${player_data?.name || ''},
        ${contractId}, ${season_id}, ${nextSeasonId}, 2,
        true, (NOW() AT TIME ZONE 'UTC')::timestamp, 'confirmed',
        3, 100,
        0, 0, 0, 0, 0, 0, 0, 0,
        (NOW() AT TIME ZONE 'UTC')::timestamp, (NOW() AT TIME ZONE 'UTC')::timestamp
      )
    `;
    
    console.log(`✅ Created contract ${contractId} for ${player_id}: ${registrationId} & ${nextRegistrationId}`);

    // Update season's confirmed_slots_filled counter if this is a confirmed registration
    if (registrationType === 'confirmed') {
      await adminDb.collection('seasons').doc(season_id).update({
        confirmed_slots_filled: FieldValue.increment(1),
      });

      const newConfirmedCount = confirmedSlotsFilled + 1;

      // Check if this is a milestone worth announcing
      if (isPlayerMilestone(newConfirmedCount)) {
        // Trigger AI news generation for milestone
        triggerNewsGeneration({
          event_type: 'player_milestone',
          category: 'milestone',
          season_id: season_id,
          season_name: seasonData?.name || season_id,
          metadata: {
            player_count: newConfirmedCount,
            milestone_number: newConfirmedCount,
          },
        }).catch(err => console.error('News generation failed:', err));
      }

      // Auto-pause registration if confirmed slots are now full
      if (newConfirmedCount >= confirmedSlotsLimit && registrationPhase === 'confirmed') {
        await adminDb.collection('seasons').doc(season_id).update({
          registration_phase: 'paused',
        });
        console.log(`📌 Registration auto-paused: Confirmed slots full (${confirmedSlotsLimit}/${confirmedSlotsLimit})`);
        
        // Trigger news for confirmed slots filled
        triggerNewsGeneration({
          event_type: 'confirmed_slots_filled',
          category: 'registration',
          season_id: season_id,
          season_name: seasonData?.name || season_id,
          metadata: {
            player_count: newConfirmedCount,
          },
        }).catch(err => console.error('News generation failed:', err));
      }
    }

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
        message: `Player registration confirmed successfully (2-season contract - ${registrationType.toUpperCase()} slot)`,
        data: {
          player_id,
          season_id,
          next_season_id: nextSeasonId,
          registration_id: registrationId,
          next_registration_id: nextRegistrationId,
          contract_id: contractId,
          contract_seasons: [season_id, nextSeasonId],
          registration_type: registrationType,
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
