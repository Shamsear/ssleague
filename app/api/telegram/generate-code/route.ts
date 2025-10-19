import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'

export async function POST(request: NextRequest) {
  try {
    const { playerId, seasonId } = await request.json()

    if (!playerId || !seasonId) {
      return NextResponse.json(
        { error: 'Missing playerId or seasonId' },
        { status: 400 }
      )
    }

    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()

    // Store in Firestore with 10 minute expiry
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + 10)

    await adminDb.collection('telegram_verifications').add({
      player_id: playerId,
      season_id: seasonId,
      verification_code: verificationCode,
      telegram_user_id: null,
      verified: false,
      created_at: FieldValue.serverTimestamp(),
      expires_at: expiresAt
    })

    return NextResponse.json({
      success: true,
      verificationCode,
      botUsername: process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
    })
  } catch (error) {
    console.error('Error generating verification code:', error)
    return NextResponse.json(
      { error: 'Failed to generate verification code' },
      { status: 500 }
    )
  }
}
