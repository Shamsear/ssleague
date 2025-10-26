import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { getTournamentDb } from '@/lib/neon/tournament-config'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { action } = await request.json()
    const requestId = params.id

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      )
    }

    // Get the request
    const requestDoc = await adminDb
      .collection('email_verification_requests')
      .doc(requestId)
      .get()

    if (!requestDoc.exists) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      )
    }

    const requestData = requestDoc.data()!

    if (action === 'approve') {
      // Update request status
      await adminDb
        .collection('email_verification_requests')
        .doc(requestId)
        .update({
          status: 'approved',
          approved_at: FieldValue.serverTimestamp()
        })

      // Check if player is already registered in Neon
      const sql = getTournamentDb();
      const registrationId = `${requestData.player_id}_${requestData.season_id}`;
      
      const existingPlayerCheck = await sql`
        SELECT id FROM player_seasons WHERE id = ${registrationId}
      `;

      if (existingPlayerCheck.length === 0) {
        // Get player name
        let playerName = 'Unknown'
        const playerSnapshot = await adminDb
          .collection('realplayers')
          .where('player_id', '==', requestData.player_id)
          .limit(1)
          .get()
        
        if (!playerSnapshot.empty) {
          playerName = playerSnapshot.docs[0].data().name
        }

        // Calculate next season for 2-season contract
        const seasonNumber = parseInt(requestData.season_id.replace(/\D/g, ''));
        const seasonPrefix = requestData.season_id.replace(/\d+$/, '');
        const nextSeasonId = `${seasonPrefix}${seasonNumber + 1}`;
        const nextRegistrationId = `${requestData.player_id}_${nextSeasonId}`;
        const contractId = `contract_${requestData.player_id}_${requestData.season_id}_${Date.now()}`;
        
        // Create player registration for CURRENT season in Neon
        await sql`
          INSERT INTO player_seasons (
            id, player_id, season_id, player_name,
            contract_id, contract_start_season, contract_end_season, contract_length,
            is_auto_registered, registration_date, registration_status,
            star_rating, points,
            matches_played, goals_scored, assists, wins, draws, losses, clean_sheets, motm_awards,
            created_at, updated_at
          )
          VALUES (
            ${registrationId}, ${requestData.player_id}, ${requestData.season_id}, ${playerName},
            ${contractId}, ${requestData.season_id}, ${nextSeasonId}, 2,
            false, NOW(), 'active',
            3, 100,
            0, 0, 0, 0, 0, 0, 0, 0,
            NOW(), NOW()
          )
        `;
        
        // Create player registration for NEXT season (auto-registered)
        await sql`
          INSERT INTO player_seasons (
            id, player_id, season_id, player_name,
            contract_id, contract_start_season, contract_end_season, contract_length,
            is_auto_registered, registration_date, registration_status,
            star_rating, points,
            matches_played, goals_scored, assists, wins, draws, losses, clean_sheets, motm_awards,
            created_at, updated_at
          )
          VALUES (
            ${nextRegistrationId}, ${requestData.player_id}, ${nextSeasonId}, ${playerName},
            ${contractId}, ${requestData.season_id}, ${nextSeasonId}, 2,
            true, NOW(), 'active',
            3, 100,
            0, 0, 0, 0, 0, 0, 0, 0,
            NOW(), NOW()
          )
        `;
        
        // Update permanent player data in Firebase realplayers
        await adminDb.collection('realplayers').doc(requestData.player_id).set({
          player_id: requestData.player_id,
          name: playerName,
          player_name: playerName,
          is_active: true,
          current_season_id: requestData.season_id,
          registration_date: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp()
        }, { merge: true });
        
        console.log(`✅ Committee registered player ${requestData.player_id} for ${requestData.season_id} with contract ${contractId}`)
      }

      return NextResponse.json({
        success: true,
        message: 'Request approved and player registered'
      })
    } else {
      // Reject
      await adminDb
        .collection('email_verification_requests')
        .doc(requestId)
        .update({
          status: 'rejected',
          rejected_at: FieldValue.serverTimestamp()
        })

      return NextResponse.json({
        success: true,
        message: 'Request rejected'
      })
    }
  } catch (error) {
    console.error('Error processing email request:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}
