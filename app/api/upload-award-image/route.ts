import { NextRequest, NextResponse } from 'next/server';
import ImageKit from 'imagekit';
import crypto from 'crypto';

// Initialize ImageKit with server-side SDK
const imagekit = new ImageKit({
  publicKey: process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY!,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY!,
  urlEndpoint: process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT!,
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Only JPG, PNG, and WEBP are allowed' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `award_${timestamp}_${originalName}`;

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Calculate file hash to check for duplicates
    const fileHash = crypto.createHash('md5').update(buffer).digest('hex');
    
    // Search for existing file with same hash in ImageKit
    try {
      const searchResponse = await imagekit.listFiles({
        searchQuery: `tags IN ["award"] AND tags IN ["hash-${fileHash}"]`,
        limit: 1,
      });
      
      // If duplicate found, return existing image
      if (searchResponse && searchResponse.length > 0) {
        const existingFile = searchResponse[0];
        return NextResponse.json({
          success: true,
          url: existingFile.url,
          fileId: existingFile.fileId,
          filename: existingFile.name,
          message: 'Image already exists - using existing file',
          isDuplicate: true,
        });
      }
    } catch (searchError) {
      console.log('Search error (continuing with upload):', searchError);
      // Continue with upload if search fails
    }

    // Upload to ImageKit with hash tag
    const uploadResponse = await imagekit.upload({
      file: buffer,
      fileName: filename,
      folder: '/awards',
      useUniqueFileName: true,
      tags: ['award', 'trophy', 'player-achievement', `hash-${fileHash}`],
    });

    return NextResponse.json({
      success: true,
      url: uploadResponse.url,
      fileId: uploadResponse.fileId,
      filename: uploadResponse.name,
      message: 'Image uploaded successfully to ImageKit'
    });

  } catch (error: any) {
    console.error('Error uploading image:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
