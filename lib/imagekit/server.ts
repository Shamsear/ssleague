import ImageKit from 'imagekit';

// Server-side ImageKit instance
let imagekitServer: ImageKit | null = null;

function getImageKitServer() {
  if (!imagekitServer) {
    const publicKey = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY;
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    const urlEndpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;

    if (!publicKey || !privateKey || !urlEndpoint) {
      throw new Error('ImageKit configuration is missing. Please check environment variables.');
    }

    imagekitServer = new ImageKit({
      publicKey,
      privateKey,
      urlEndpoint,
    });
  }
  return imagekitServer;
}

export interface ServerUploadOptions {
  file: Buffer;
  fileName: string;
  folder?: string;
  tags?: string[];
  useUniqueFileName?: boolean;
}

export interface ServerUploadResult {
  url: string;
  fileId: string;
  name: string;
  size: number;
  filePath: string;
  thumbnailUrl?: string;
}

/**
 * Upload an image to ImageKit (server-side)
 */
export async function uploadImageServer(options: ServerUploadOptions): Promise<ServerUploadResult> {
  try {
    const ik = getImageKitServer();

    console.log('Uploading to ImageKit (server):', {
      fileName: options.fileName,
      folder: options.folder,
      fileSize: options.file.length,
    });

    const result = await ik.upload({
      file: options.file,
      fileName: options.fileName,
      folder: options.folder || '/player-photos',
      tags: options.tags,
      useUniqueFileName: options.useUniqueFileName !== false,
    });

    console.log('✅ ImageKit server upload success:', result.url);

    return {
      url: result.url,
      fileId: result.fileId,
      name: result.name,
      size: result.size,
      filePath: result.filePath,
      thumbnailUrl: result.thumbnailUrl,
    };
  } catch (error: any) {
    console.error('❌ ImageKit server upload error:', error);
    throw new Error(error.message || 'Upload failed');
  }
}

/**
 * Delete an image from ImageKit (server-side)
 */
export async function deleteImageServer(fileId: string): Promise<void> {
  try {
    const ik = getImageKitServer();
    await ik.deleteFile(fileId);
    console.log('✅ ImageKit server delete success');
  } catch (error: any) {
    console.error('❌ ImageKit server delete error:', error);
    throw new Error(error.message || 'Delete failed');
  }
}

/**
 * Upload player photo (server-side)
 */
export async function uploadPlayerPhotoServer(
  playerId: string,
  file: File
): Promise<{ url: string; fileId: string }> {
  try {
    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const fileExtension = file.name.split('.').pop();
    const timestamp = Date.now();
    const fileName = `${playerId}_${timestamp}.${fileExtension}`;

    const result = await uploadImageServer({
      file: buffer,
      fileName,
      folder: '/player-photos',
      tags: ['player', 'photo', playerId],
      useUniqueFileName: false,
    });

    return {
      url: result.url,
      fileId: result.fileId,
    };
  } catch (error) {
    console.error('❌ Error uploading player photo (server):', error);
    throw error;
  }
}

/**
 * Bulk upload player photos (server-side)
 */
export async function bulkUploadPlayerPhotosServer(
  uploads: Array<{ playerId: string; file: File }>
): Promise<Array<{ playerId: string; url: string; fileId: string; error?: string }>> {
  const results = await Promise.allSettled(
    uploads.map(async ({ playerId, file }) => {
      const result = await uploadPlayerPhotoServer(playerId, file);
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
