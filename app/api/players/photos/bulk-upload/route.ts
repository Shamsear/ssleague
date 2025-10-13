import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No files provided' },
        { status: 400 }
      );
    }

    const results = [];
    const errors = [];

    for (const file of files) {
      try {
        // Extract player_id from filename (before the extension)
        // Expected format: 12345.jpg or player_12345.png
        const fileName = file.name;
        const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
        const playerId = nameWithoutExt.replace(/^player_/i, ''); // Remove "player_" prefix if exists
        
        const fileExtension = file.name.split('.').pop();
        const blobFileName = `${playerId}.${fileExtension}`;

        // Upload to Vercel Blob
        const blob = await put(`player-photos/${blobFileName}`, file, {
          access: 'public',
          addRandomSuffix: false,
        });

        results.push({
          playerId,
          fileName: file.name,
          url: blob.url,
          success: true,
        });

        console.log(`✅ Uploaded photo for player ${playerId}`);
      } catch (error: any) {
        errors.push({
          fileName: file.name,
          error: error.message,
        });
        console.error(`❌ Failed to upload ${file.name}:`, error);
      }
    }

    const successCount = results.length;
    const errorCount = errors.length;

    return NextResponse.json({
      success: true,
      message: `Uploaded ${successCount} photos successfully${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
      results,
      errors,
      summary: {
        total: files.length,
        success: successCount,
        failed: errorCount,
      },
    });
  } catch (error: any) {
    console.error('❌ Bulk upload error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to upload photos',
      },
      { status: 500 }
    );
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb', // Allow bulk uploads
    },
  },
};
