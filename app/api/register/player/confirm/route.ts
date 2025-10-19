import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * POST /api/register/player/confirm
 * Confirm player self-registration
 * Uses Admin SDK to bypass security rules
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.player_id || !body.season_id || !body.user_email || !body.user_uid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
        },
        { status: 400 }
      );
    }

    const { player_id, season_id, user_email, user_uid, player_data } = body;

    // Check if player already registered for this season
    const registrationId = `${player_id}_${season_id}`;
    const existingRegistration = await adminDb
      .collection('realplayer')
      .doc(registrationId)
      .get();

    if (existingRegistration.exists) {
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

    // Create registration for CURRENT season in realplayer collection
    const currentSeasonData = {
      season_id,
      player_id,
      name: player_data?.name || '',
      player_name: player_data?.name || '',
      place: player_data?.place || null,
      date_of_birth: player_data?.date_of_birth || null,
      email: player_data?.email || null,
      phone: player_data?.phone || null,
      
      // Contract fields
      contract_id: contractId,
      contract_start_season: season_id,
      contract_end_season: nextSeasonId,
      contract_length: 2,
      is_auto_registered: false, // This is the initial registration
      
      registration_date: FieldValue.serverTimestamp(),
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    };
    
    await adminDb.collection('realplayer').doc(registrationId).set(currentSeasonData);
    
    // Create registration for NEXT season (auto-registered as part of contract)
    const nextSeasonData = {
      season_id: nextSeasonId,
      player_id,
      name: player_data?.name || '',
      player_name: player_data?.name || '',
      place: player_data?.place || null,
      date_of_birth: player_data?.date_of_birth || null,
      email: player_data?.email || null,
      phone: player_data?.phone || null,
      
      // Contract fields
      contract_id: contractId,
      contract_start_season: season_id,
      contract_end_season: nextSeasonId,
      contract_length: 2,
      is_auto_registered: true, // This is auto-created from contract
      
      registration_date: FieldValue.serverTimestamp(),
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    };
    
    await adminDb.collection('realplayer').doc(nextRegistrationId).set(nextSeasonData);
    
    console.log(`✅ Created contract ${contractId} for ${player_id}: ${registrationId} & ${nextRegistrationId}`);

    // Update is_registered in realplayers collection
    const playersQuery = await adminDb
      .collection('realplayers')
      .where('player_id', '==', player_id)
      .limit(1)
      .get();

    if (!playersQuery.empty) {
      const playerDoc = playersQuery.docs[0];
      const updateData: any = {
        is_registered: true,
        season_id,
        registered_email: user_email,
        registered_user_id: user_uid,
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
