import { NextRequest, NextResponse } from 'next/server';
import { uploadPlayerPhotoServer } from '@/lib/imagekit/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const playerId = formData.get('playerId') as string;

    if (!file || !playerId) {
      return NextResponse.json(
        { error: 'File and playerId are required' },
        { status: 400 }
      );
    }

    // Upload to ImageKit (server-side)
    const result = await uploadPlayerPhotoServer(playerId, file);

    return NextResponse.json({ 
      url: result.url,
      fileId: result.fileId,
      playerId,
      fileName: file.name
    });
  } catch (error: any) {
    console.error('Error uploading photo:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload photo' },
      { status: 500 }
    );
  }
}

// Maximum file size: 4.5MB (Vercel limit)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4.5mb',
    },
  },
};
