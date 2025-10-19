import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'

interface TelegramUpdate {
  message?: {
    from: {
      id: number
      username?: string
      first_name: string
    }
    text: string
    chat: {
      id: number
    }
  }
}

async function sendTelegramMessage(chatId: number, text: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`
  
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML'
    })
  })
}

export async function POST(request: NextRequest) {
  try {
    const update: TelegramUpdate = await request.json()

    if (!update.message?.text) {
      return NextResponse.json({ ok: true })
    }

    const { from, text, chat } = update.message
    const code = text.trim()

    // Check if it's a 6-digit code
    if (!/^\d{6}$/.test(code)) {
      await sendTelegramMessage(
        chat.id,
        '❌ Please send a valid 6-digit verification code.\n\n' +
        'Get your code from the player registration page.'
      )
      return NextResponse.json({ ok: true })
    }

    // Look up the verification code
    const snapshot = await adminDb
      .collection('telegram_verifications')
      .where('verification_code', '==', code)
      .limit(1)
      .get()

    if (snapshot.empty) {
      await sendTelegramMessage(
        chat.id,
        '❌ Invalid verification code.\n\n' +
        'Please check your code and try again.'
      )
      return NextResponse.json({ ok: true })
    }

    const docSnapshot = snapshot.docs[0]
    const data = docSnapshot.data()

    // Check if already verified
    if (data.verified) {
      await sendTelegramMessage(
        chat.id,
        '⚠️ This code has already been used.'
      )
      return NextResponse.json({ ok: true })
    }

    // Check if expired
    const now = new Date()
    const expiresAt = data.expires_at.toDate()
    
    if (now > expiresAt) {
      await sendTelegramMessage(
        chat.id,
        '❌ This verification code has expired.\n\n' +
        'Please generate a new code from the registration page.'
      )
      return NextResponse.json({ ok: true })
    }

    // Mark as verified
    await adminDb
      .collection('telegram_verifications')
      .doc(docSnapshot.id)
      .update({
        verified: true,
        telegram_user_id: from.id.toString(),
        telegram_username: from.username || null,
        telegram_first_name: from.first_name,
        verified_at: FieldValue.serverTimestamp()
      })

    await sendTelegramMessage(
      chat.id,
      '✅ <b>Verification Successful!</b>\n\n' +
      `Welcome, ${from.first_name}! Your player registration has been verified.\n\n` +
      'You can now close this chat and continue on the registration page.'
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Telegram webhook error:', error)
    return NextResponse.json({ ok: true })
  }
}
