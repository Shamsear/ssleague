import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'

export async function POST(request: NextRequest) {
  try {
    const { verificationCode } = await request.json()

    if (!verificationCode) {
      return NextResponse.json(
        { error: 'Missing verificationCode' },
        { status: 400 }
      )
    }

    // Check if code exists and is verified
    const snapshot = await adminDb
      .collection('telegram_verifications')
      .where('verification_code', '==', verificationCode)
      .limit(1)
      .get()

    if (snapshot.empty) {
      return NextResponse.json({
        verified: false,
        message: 'Invalid verification code'
      })
    }

    const doc = snapshot.docs[0]
    const data = doc.data()

    // Check if expired
    const now = new Date()
    const expiresAt = data.expires_at.toDate()
    if (expiresAt < now) {
      return NextResponse.json({
        verified: false,
        message: 'Verification code expired'
      })
    }

    // Check if verified
    if (data.verified && data.telegram_user_id) {
      return NextResponse.json({
        verified: true,
        telegramUserId: data.telegram_user_id,
        telegramUsername: data.telegram_username || null
      })
    }

    return NextResponse.json({
      verified: false,
      message: 'Waiting for Telegram verification'
    })
  } catch (error) {
    console.error('Error checking verification:', error)
    return NextResponse.json(
      { error: 'Failed to check verification status' },
      { status: 500 }
    )
  }
}
