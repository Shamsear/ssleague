import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'

export async function POST(request: NextRequest) {
  try {
    const { playerId, seasonId, email, reason } = await request.json()

    if (!playerId || !seasonId || !email) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if there's already a pending request
    const existingSnapshot = await adminDb
      .collection('email_verification_requests')
      .where('player_id', '==', playerId)
      .where('season_id', '==', seasonId)
      .where('status', '==', 'pending')
      .limit(1)
      .get()

    if (!existingSnapshot.empty) {
      return NextResponse.json(
        { error: 'You already have a pending verification request' },
        { status: 400 }
      )
    }

    // Create new request
    await adminDb.collection('email_verification_requests').add({
      player_id: playerId,
      season_id: seasonId,
      email,
      reason: reason || 'Does not have Telegram',
      status: 'pending',
      created_at: FieldValue.serverTimestamp()
    })

    return NextResponse.json({
      success: true,
      message: 'Verification request submitted successfully'
    })
  } catch (error) {
    console.error('Error submitting email verification request:', error)
    return NextResponse.json(
      { error: 'Failed to submit verification request' },
      { status: 500 }
    )
  }
}
