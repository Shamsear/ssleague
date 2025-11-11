import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/players/[id]/details
 * Get player details including photo from Firestore
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const playerId = params.id;
    
    // Query for player by player_id
    const playersSnapshot = await adminDb
      .collection('realplayers')
      .where('player_id', '==', playerId)
      .limit(1)
      .get();
    
    if (playersSnapshot.empty) {
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }
    
    const playerDoc = playersSnapshot.docs[0];
    const playerData = playerDoc.data();
    
    return NextResponse.json({
      success: true,
      player: {
        player_id: playerData.player_id,
        name: playerData.name,
        photo_url: playerData.photo_url,
        photo_file_id: playerData.photo_file_id,
        // Photo positioning for circle shape
        photo_position_circle: playerData.photo_position_circle,
        photo_scale_circle: playerData.photo_scale_circle,
        photo_position_x_circle: playerData.photo_position_x_circle,
        photo_position_y_circle: playerData.photo_position_y_circle,
        // Photo positioning for square shape
        photo_position_square: playerData.photo_position_square,
        photo_scale_square: playerData.photo_scale_square,
        photo_position_x_square: playerData.photo_position_x_square,
        photo_position_y_square: playerData.photo_position_y_square,
        email: playerData.email,
        phone: playerData.phone,
        psn_id: playerData.psn_id,
        xbox_id: playerData.xbox_id,
        steam_id: playerData.steam_id,
        place: playerData.place,
        date_of_birth: playerData.date_of_birth,
      }
    });
  } catch (error: any) {
    console.error('Error fetching player details:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch player details' },
      { status: 500 }
    );
  }
}
