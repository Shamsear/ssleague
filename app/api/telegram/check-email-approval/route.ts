import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'

export async function POST(request: NextRequest) {
  try {
    const { playerId, seasonId } = await request.json()

    if (!playerId || !seasonId) {
      return NextResponse.json(
        { error: 'Missing playerId or seasonId' },
        { status: 400 }
      )
    }

    // Check if there's an approved request
    const requestSnapshot = await adminDb
      .collection('email_verification_requests')
      .where('player_id', '==', playerId)
      .where('season_id', '==', seasonId)
      .where('status', '==', 'approved')
      .limit(1)
      .get()

    if (!requestSnapshot.empty) {
      // Approved! Check if player is registered
      const playerSnapshot = await adminDb
        .collection('realplayer')
        .where('player_id', '==', playerId)
        .where('season_id', '==', seasonId)
        .limit(1)
        .get()

      return NextResponse.json({
        approved: true,
        registered: !playerSnapshot.empty
      })
    }

    // Check if rejected
    const rejectedSnapshot = await adminDb
      .collection('email_verification_requests')
      .where('player_id', '==', playerId)
      .where('season_id', '==', seasonId)
      .where('status', '==', 'rejected')
      .limit(1)
      .get()

    if (!rejectedSnapshot.empty) {
      return NextResponse.json({
        approved: false,
        rejected: true,
        message: 'Your verification request was rejected by an admin'
      })
    }

    // Still pending
    return NextResponse.json({
      approved: false,
      rejected: false,
      message: 'Waiting for admin approval'
    })
  } catch (error) {
    console.error('Error checking email approval:', error)
    return NextResponse.json(
      { error: 'Failed to check approval status' },
      { status: 500 }
    )
  }
}
