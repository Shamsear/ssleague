import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

// Player IDs that registered with photos
const PLAYER_IDS = [
  'sspslpsl0007', // Umar
  'sspslpsl0005', // Goku
  'sspslpsl0055', // Karthik
  'sspslpsl0097', // Nishal
  'sspslpsl0084', // Abu
];

// ImageKit configuration
const IMAGEKIT_URL_ENDPOINT = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || '';

// Common image extensions
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

/**
 * Check if a URL exists by making a HEAD request
 */
async function urlExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Find the correct image extension for a player photo
 */
async function findPlayerPhotoUrl(playerId: string): Promise<string | null> {
  for (const ext of IMAGE_EXTENSIONS) {
    const url = `${IMAGEKIT_URL_ENDPOINT}/player-photos/${playerId}.${ext}`;
    
    if (await urlExists(url)) {
      return url;
    }
  }
  
  return null;
}

/**
 * Update player document with photo URL
 */
async function updatePlayerPhoto(playerId: string, photoUrl: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Query for player document by player_id field
    const playersSnapshot = await adminDb
      .collection('realplayers')
      .where('player_id', '==', playerId)
      .limit(1)
      .get();
    
    if (playersSnapshot.empty) {
      return { success: false, error: 'Player document not found' };
    }
    
    const playerDoc = playersSnapshot.docs[0];
    
    // Extract fileId from URL
    const matches = photoUrl.match(/player-photos\/([^/]+)$/);
    const photoFileId = matches ? matches[1] : null;
    
    await playerDoc.ref.update({
      photo_url: photoUrl,
      photo_file_id: photoFileId,
      updated_at: FieldValue.serverTimestamp(),
    });
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * POST /api/migrate/player-photos
 * Migrate player photos from ImageKit to Firestore
 */
export async function POST() {
  try {
    const results = [];
    
    for (const playerId of PLAYER_IDS) {
      // Find the photo URL
      const photoUrl = await findPlayerPhotoUrl(playerId);
      
      if (!photoUrl) {
        results.push({
          playerId,
          success: false,
          error: 'No photo found in ImageKit',
        });
        continue;
      }
      
      // Update Firestore document
      const result = await updatePlayerPhoto(playerId, photoUrl);
      results.push({
        playerId,
        photoUrl: result.success ? photoUrl : undefined,
        ...result,
      });
    }
    
    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;
    
    return NextResponse.json({
      success: true,
      message: `Migration completed: ${successCount} successful, ${failedCount} failed`,
      summary: {
        total: PLAYER_IDS.length,
        successful: successCount,
        failed: failedCount,
      },
      results,
    });
  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to migrate player photos',
      },
      { status: 500 }
    );
  }
}
