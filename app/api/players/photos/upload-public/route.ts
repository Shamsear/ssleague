import { NextRequest, NextResponse } from 'next/server';
import { bulkUploadPlayerPhotos } from '@/lib/imagekit/playerPhotos';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    // Extract player IDs from filenames (assuming format: playerId.ext)
    const uploads = files.map(file => {
      const playerId = file.name.split('.')[0];
      return { playerId, file };
    });

    // Upload to ImageKit
    const results = await bulkUploadPlayerPhotos(uploads);

    const successCount = results.filter(r => !r.error).length;
    const errorCount = results.filter(r => r.error).length;
    
    return NextResponse.json({
      success: true,
      message: `Uploaded ${successCount} photos successfully${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
      results: results.map(r => ({
        success: !r.error,
        fileName: `${r.playerId}.jpg`,
        url: r.url,
        fileId: r.fileId,
        error: r.error
      })),
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
      sizeLimit: '50mb',
    },
  },
};
