import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const playerId = formData.get('playerId') as string;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!playerId) {
      return NextResponse.json(
        { success: false, error: 'Player ID is required' },
        { status: 400 }
      );
    }

    // Get file extension
    const fileExtension = file.name.split('.').pop();
    const fileName = `${playerId}.${fileExtension}`;

    // Upload to Vercel Blob
    const blob = await put(`player-photos/${fileName}`, file, {
      access: 'public',
      addRandomSuffix: false, // Keep player_id as exact name
    });

    console.log('✅ Photo uploaded:', blob.url);

    return NextResponse.json({
      success: true,
      url: blob.url,
      message: 'Photo uploaded successfully'
    });
  } catch (error: any) {
    console.error('❌ Error uploading photo:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to upload photo'
      },
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
