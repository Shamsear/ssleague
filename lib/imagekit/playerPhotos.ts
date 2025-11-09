import { uploadImage, deleteImage, getOptimizedImageUrl } from './upload';

/**
 * Upload player photo to ImageKit
 * @param playerId - Unique player ID
 * @param file - Image file to upload
 * @returns ImageKit URL and fileId
 */
export async function uploadPlayerPhoto(playerId: string, file: File): Promise<{ url: string; fileId: string }> {
  try {
    const fileExtension = file.name.split('.').pop();
    const timestamp = Date.now();
    const fileName = `${playerId}_${timestamp}.${fileExtension}`;
    
    const result = await uploadImage({
      file,
      fileName,
      folder: '/player-photos',
      tags: ['player', 'photo', playerId],
      useUniqueFileName: false, // Use timestamp-based naming to prevent conflicts
    });
    
    console.log('✅ Player photo uploaded successfully:', result.url);
    return {
      url: result.url,
      fileId: result.fileId,
    };
  } catch (error) {
    console.error('❌ Error uploading player photo:', error);
    throw error;
  }
}

/**
 * Delete player photo from ImageKit
 * @param fileId - ImageKit file ID
 */
export async function deletePlayerPhoto(fileId: string): Promise<boolean> {
  try {
    await deleteImage(fileId);
    console.log('✅ Player photo deleted successfully');
    return true;
  } catch (error) {
    console.error('❌ Error deleting player photo:', error);
    return false;
  }
}

/**
 * Get optimized player photo URL
 * @param url - Original ImageKit URL
 * @param size - Desired size (default: 200x200)
 * @returns Optimized URL
 */
export function getPlayerPhotoURL(url: string, size: number = 200): string {
  if (!url) return '/images/player-placeholder.png';
  
  return getOptimizedImageUrl(url, {
    width: size,
    height: size,
    quality: 85,
    format: 'auto',
    crop: 'maintain_ratio',
  });
}

/**
 * Bulk upload player photos
 * @param uploads - Array of {playerId, file} objects
 * @returns Array of successful upload results
 */
export async function bulkUploadPlayerPhotos(
  uploads: Array<{ playerId: string; file: File }>
): Promise<Array<{ playerId: string; url: string; fileId: string; error?: string }>> {
  const results = await Promise.allSettled(
    uploads.map(async ({ playerId, file }) => {
      const result = await uploadPlayerPhoto(playerId, file);
      return { playerId, ...result };
    })
  );
  
  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        playerId: uploads[index].playerId,
        url: '',
        fileId: '',
        error: result.reason?.message || 'Upload failed',
      };
    }
  });
}
