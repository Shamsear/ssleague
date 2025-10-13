import { put, del, list } from '@vercel/blob';

/**
 * Upload player photo to Vercel Blob Storage
 * @param playerId - Unique player ID
 * @param file - Image file to upload
 * @returns Blob URL of uploaded image
 */
export async function uploadPlayerPhoto(playerId: string, file: File): Promise<string> {
  try {
    const fileExtension = file.name.split('.').pop();
    const fileName = `${playerId}.${fileExtension}`;
    
    const blob = await put(`player-photos/${fileName}`, file, {
      access: 'public',
      addRandomSuffix: false, // Keep consistent naming
    });
    
    console.log('✅ Photo uploaded successfully:', blob.url);
    return blob.url;
  } catch (error) {
    console.error('❌ Error uploading player photo:', error);
    throw error;
  }
}

/**
 * Delete player photo from Vercel Blob Storage
 * @param playerId - Unique player ID
 */
export async function deletePlayerPhoto(playerId: string): Promise<boolean> {
  try {
    const { blobs } = await list({ prefix: `player-photos/${playerId}` });
    
    if (blobs.length > 0) {
      await del(blobs[0].url);
      console.log('✅ Photo deleted successfully');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('❌ Error deleting player photo:', error);
    throw error;
  }
}

/**
 * Get player photo URL
 * @param playerId - Unique player ID
 * @returns Blob URL or placeholder
 */
export async function getPlayerPhotoURL(playerId: string): Promise<string> {
  try {
    const { blobs } = await list({ prefix: `player-photos/${playerId}` });
    
    if (blobs.length > 0) {
      return blobs[0].url;
    }
    
    return '/images/player-placeholder.png';
  } catch (error) {
    console.error('❌ Error getting player photo URL:', error);
    return '/images/player-placeholder.png';
  }
}
