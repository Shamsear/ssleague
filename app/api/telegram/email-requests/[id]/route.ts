import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'

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

      // Check if player is already registered
      const existingPlayerSnapshot = await adminDb
        .collection('realplayer')
        .where('season_id', '==', requestData.season_id)
        .where('player_id', '==', requestData.player_id)
        .limit(1)
        .get()

      if (existingPlayerSnapshot.empty) {
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

        // Create player registration
        await adminDb.collection('realplayer').add({
          season_id: requestData.season_id,
          player_id: requestData.player_id,
          name: playerName,
          registration_status: 'pending',
          is_active: true,
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
          verified_via: 'email_approval'
        })
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
