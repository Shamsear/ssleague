import { NextRequest, NextResponse } from 'next/server';
import { uploadPlayerPhoto } from '@/lib/imagekit/playerPhotos';

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

    // Upload to ImageKit
    const result = await uploadPlayerPhoto(playerId, file);

    return NextResponse.json({ 
      url: result.url,
      fileId: result.fileId,
      playerId,
      fileName: file.name
    });
  } catch (error) {
    console.error('Error uploading photo:', error);
    return NextResponse.json(
      { error: 'Failed to upload photo' },
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
