import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const postUrl = searchParams.get('url');

    if (!postUrl) {
      return NextResponse.json(
        { error: 'Instagram post URL is required' },
        { status: 400 }
      );
    }

    // Fetch from Instagram's oEmbed API
    const oembedUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(postUrl)}`;
    
    const response = await fetch(oembedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Instagram API responded with ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching Instagram oEmbed:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch Instagram post' },
      { status: 500 }
    );
  }
}
