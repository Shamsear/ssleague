import { NextRequest, NextResponse } from 'next/server';
import ImageKit from 'imagekit';

// Initialize ImageKit server-side
const imagekit = new ImageKit({
  publicKey: process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || '',
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY || '',
  urlEndpoint: process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || '',
});

export async function GET(request: NextRequest) {
  try {
    // Generate authentication parameters
    const authParams = imagekit.getAuthenticationParameters();
    
    return NextResponse.json(authParams);
  } catch (error) {
    console.error('ImageKit auth error:', error);
    return NextResponse.json(
      { error: 'Failed to generate authentication parameters' },
      { status: 500 }
    );
  }
}
