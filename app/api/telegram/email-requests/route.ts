import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const seasonId = searchParams.get('seasonId')

    if (!seasonId) {
      return NextResponse.json(
        { error: 'Missing seasonId' },
        { status: 400 }
      )
    }

    // Fetch pending requests (filter status client-side to avoid index requirement)
    const snapshot = await adminDb
      .collection('email_verification_requests')
      .where('season_id', '==', seasonId)
      .get()

    const requests = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data()
        
        // Fetch player name
        let playerName = 'Unknown'
        try {
          const playerSnapshot = await adminDb
            .collection('realplayers')
            .where('player_id', '==', data.player_id)
            .limit(1)
            .get()
          
          if (!playerSnapshot.empty) {
            playerName = playerSnapshot.docs[0].data().name
          }
        } catch (err) {
          console.error('Error fetching player name:', err)
        }

        return {
          id: doc.id,
          player_id: data.player_id,
          season_id: data.season_id,
          email: data.email,
          reason: data.reason || '',
          status: data.status,
          created_at: data.created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
          player_name: playerName
        }
      })
    )

    return NextResponse.json({ requests })
  } catch (error) {
    console.error('Error fetching email requests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch email verification requests' },
      { status: 500 }
    )
  }
}
