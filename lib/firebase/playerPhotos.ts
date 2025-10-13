import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { app } from './config';

const storage = getStorage(app);

/**
 * Upload player photo to Firebase Storage
 * @param playerId - Unique player ID
 * @param file - Image file to upload
 * @returns Download URL of uploaded image
 */
export async function uploadPlayerPhoto(playerId: string, file: File): Promise<string> {
  try {
    // Create reference with player_id as filename
    const fileExtension = file.name.split('.').pop();
    const fileName = `${playerId}.${fileExtension}`;
    const storageRef = ref(storage, `player-photos/${fileName}`);
    
    // Upload file
    const snapshot = await uploadBytes(storageRef, file, {
      contentType: file.type,
      customMetadata: {
        uploadedAt: new Date().toISOString(),
        playerId: playerId
      }
    });
    
    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log('✅ Photo uploaded successfully:', downloadURL);
    
    return downloadURL;
  } catch (error) {
    console.error('❌ Error uploading player photo:', error);
    throw error;
  }
}

/**
 * Get player photo URL from Firebase Storage
 * @param playerId - Unique player ID
 * @param extension - File extension (default: jpg)
 * @returns Download URL or null if not found
 */
export async function getPlayerPhotoURL(
  playerId: string, 
  extension: string = 'jpg'
): Promise<string | null> {
  try {
    const fileName = `${playerId}.${extension}`;
    const storageRef = ref(storage, `player-photos/${fileName}`);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error: any) {
    // If file not found, try alternative extensions
    if (error.code === 'storage/object-not-found') {
      const alternativeExtensions = ['png', 'jpeg', 'webp'];
      for (const ext of alternativeExtensions) {
        if (ext !== extension) {
          try {
            const altFileName = `${playerId}.${ext}`;
            const altRef = ref(storage, `player-photos/${altFileName}`);
            const altURL = await getDownloadURL(altRef);
            return altURL;
          } catch {
            continue;
          }
        }
      }
      // Return null if no photo found with any extension
      return null;
    }
    console.error('❌ Error getting player photo URL:', error);
    return null;
  }
}

/**
 * Delete player photo from Firebase Storage
 * @param playerId - Unique player ID
 * @param extension - File extension (default: jpg)
 */
export async function deletePlayerPhoto(
  playerId: string,
  extension: string = 'jpg'
): Promise<boolean> {
  try {
    const fileName = `${playerId}.${extension}`;
    const storageRef = ref(storage, `player-photos/${fileName}`);
    await deleteObject(storageRef);
    console.log('✅ Photo deleted successfully');
    return true;
  } catch (error: any) {
    if (error.code === 'storage/object-not-found') {
      console.log('ℹ️ Photo not found, nothing to delete');
      return false;
    }
    console.error('❌ Error deleting player photo:', error);
    throw error;
  }
}

/**
 * Get player photo URL with fallback to placeholder
 * @param playerId - Unique player ID
 * @returns Download URL or placeholder URL
 */
export async function getPlayerPhotoOrPlaceholder(playerId: string): Promise<string> {
  const photoURL = await getPlayerPhotoURL(playerId);
  return photoURL || '/images/player-placeholder.png';
}

/**
 * Bulk upload player photos
 * @param uploads - Array of {playerId, file} objects
 * @returns Array of successful upload results
 */
export async function bulkUploadPlayerPhotos(
  uploads: { playerId: string; file: File }[]
): Promise<{ playerId: string; url: string; success: boolean }[]> {
  const results = await Promise.allSettled(
    uploads.map(async ({ playerId, file }) => {
      const url = await uploadPlayerPhoto(playerId, file);
      return { playerId, url, success: true };
    })
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        playerId: uploads[index].playerId,
        url: '',
        success: false
      };
    }
  });
}
